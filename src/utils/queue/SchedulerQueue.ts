import Bull from "bull"
import fetch from "node-fetch"
import { ActivityScheduler, removeDuplicateParticipants } from "../../utils/ActivitySchedulerJob"
import { Mutex } from "async-mutex"
import { TypeRepository, SensorEventRepository } from "../../repository"
const clientLock = new Mutex()
//Initialise Scheduler Queue
export const SchedulerQueue = new Bull("Scheduler", process.env.REDIS_HOST ?? "")

//Consume job from Scheduler
SchedulerQueue.process(async (job: any, done: any) => {
  const data: any = job.data
  try {
    let start_notify=true    
    if(data.start_date !== undefined) {
      let today = new Date().toString()
      let TimeExploded = today.split('T')
      let timHr = TimeExploded[1].split(':')[0]
      let timMt = TimeExploded[1].split(':')[1]
      let today_date = new Date(`${TimeExploded[0]}T${timHr}:${timMt}:00.000Z`)
      let start_date = new Date(data.start_date)
      console.log("today_date while notify",today_date)
      console.log("start_date while notify",start_date)
      if(start_date > today_date)
       start_notify=false
    }
    if (start_notify) {
    //removing duplicate device token (if any)
    const uniqueParticipants = await removeDuplicateParticipants(data.participants)
    for (const device of uniqueParticipants) {
      const device_type = device.device_type
      const device_token = device.device_token
      const participant_id = device.participant_id
      let shouldSend=true
        try {
	const notificationSettings = await TypeRepository._get("a",participant_id,"to.unityhealth.psychiatry.settings")
	console.log("notificationSettings",notificationSettings)
	// console.log("notificationSettings.notif",notificationSettings.notification)
	//	console.log("partId",participant_id )
          if(!notificationSettings.notification) {
            shouldSend=false
          }
        } catch (error) {

	}
	//	console.log("device_token",device_token )
	//	console.log("devicetype",device_type)
	//	console.log("partId",participant_id)
	//	console.log("shouldSend",shouldSend)

      if (undefined !== device_token && undefined !== device_type && undefined !== participant_id && shouldSend) {
      //console.log("sent to..", participant_id );
      sendNotification(device_token, device_type, {
          participant_id: participant_id,
          activity_id: data.activity_id,
          message: data.message,
          title: data.title,
          url:`/participant/${participant_id}/activity/${data.activity_id}`
        })
      }
    }
  }
  } catch (error) {}
  done()
})
//listen to the competed event of Scheduler Queue
SchedulerQueue.on("completed", async (job) => {
  console.log(`Completed  job state on ${job.data.activity_id}`)
  const release = await clientLock.acquire()
  try {
    console.log(`locked job on ${job.data.activity_id}`)
    console.log("jobs in queue")
    await ActivityScheduler(job.data.activity_id)
    release()
    console.log(`Rescheduled job after notificcation process-  ${job.data.activity_id}`)
    console.log(`release lock  on success  ${job.data.activity_id}`)
  } catch (error) {
    //release the lock for thread
    release()
    console.log(`release lock  on exception2  ${job.data.activity_id}`)
  }
})

/// Send to device with payload and device token given.
export async  function sendNotification(device_token: string, device_type: string, payload: any): Promise<void> {
  console.dir({ device_token, device_type, payload })
  // Send this specific page URL to the device to show the actual activity.
  // eslint-disable-next-line prettier/prettier
  const url = payload.url
  //  const notificationId =(Math.floor(Math.random() * 10000) + 1) + new Date().getTime()
 const notificationId =  Math.floor(Math.random() * 1000000) + 1
  const gatewayURL:any = !!process.env.APP_GATEWAY ? `https://${process.env.APP_GATEWAY}/push` : `${process.env.PUSH_GATEWAY}`
  const gatewayApiKey:any = !!process.env.PUSH_API_KEY ? `${process.env.PUSH_API_KEY}`  : `${process.env.PUSH_GATEWAY_APIKEY}`

  //console.log(url)
try {
  if("undefined"=== gatewayURL) {
    throw new Error("Push gateway address is not defined")
  }
  if("undefined"=== gatewayApiKey) {
     throw new Error("Push gateway apikey is not defined")
  }
  switch (device_type) {
    case "android.watch":
    case "android":
      try {
        const opts: any = {
          push_type: "gcm",
          api_key: gatewayApiKey,
          device_token: device_token,
          payload: {
            priority: "high",
            data: {
              title: `${payload.title}`,
              message: `${payload.message}`,
              page: `${url}`,
              notificationId: notificationId,
              actions: [{ name: "Open App", page: `${process.env.DASHBOARD_URL}` }],
              expiry:21600000,
            },
          },
        }
        //connect to api gateway and send notifications
        fetch('http://192.168.96.137:3003/push', {
          method: "post",
          body: JSON.stringify(opts),
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error! status`)
	      }else{
	      console.log("Error sending notifications.....")
	      }
          })
          .catch((e) => {
            console.log("Error encountered sending GCM push notification.")
          })
      } catch (error) {
        console.log(`"Error encountered sending GCM push notification"-${error}`)
      }
      break

    case "ios":
      try {
        //preparing curl request
        const opts: any = {
          push_type: "apns",               
          api_key:gatewayApiKey,
          device_token: device_token,
          payload: {
            aps: {
              alert: `${payload.message}`,
              badge: 0,
              sound: "default",
              "mutable-content": 1,
              "content-available": 1,
              "push-type":"alert",
              "collapse-id":`${notificationId}`,
              "expiration":10
            },  
            notificationId: `${notificationId}`,
            expiry: 21600000,          
            page: `${url}`,
            actions: [{ name: "Open App", page: `${url}` }],
          }
        }

        // Collect the Participant's device token, if there is one saved.
          const event_data = await SensorEventRepository._select(
            payload.participant_id,
            "lamp.analytics",
            undefined,
            undefined,
            1000
          )
          let appVersion:any =''
          if (event_data.length !== 0) {
          const filteredArray: any = await event_data.filter(
            (x) => (x.data.type === undefined && x.data.action !== "notification" && x.data.device_type !== "Dashboard")
          )
                     console.log('filteredArray',filteredArray)
          if (filteredArray.length !== 0) {
          const events: any = filteredArray[0]
	  const device = undefined !== events && undefined !== events.data ? events.data : undefined
	  console.log("device121212",device)
            if (device !== undefined ) {
             appVersion = device.user_agent
          }
        }
        }
        //for new
        console.log("appVersion",appVersion);
    
        // '1.0, iPhone, 14.4.2'
        // "DiiG 2021.6.29; iOS 14.3; iPhone iPhone8,1"
        // "NativeCore 2021.6.29; iOS 14.3; iPhone iPhone8,1"

          console.log("appVersion",appVersion);
        let appVersion_:any=''
        if(''!==appVersion )  {
          appVersion_= appVersion.split(',')[0].trim()
	  }
	  console.log("appVer--==",appVersion);
	if("1.0"===appVersion_ || appVersion.toLowerCase().search('diig')!==-1)  {
    console.log("newversion")
                         //connect to api gateway and send notifications
        fetch('http://192.168.96.137:3003/push', {
          method: "post",
          body: JSON.stringify(opts),
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error!`)
            }
          })
	  .catch((e) => {console.log("e1",e)
            console.log("Error encountered sending APN push notification.")
          })




	  }else {console.log("oldversion");
	  console.log("url gatewy used",gatewayURL);

        //connect to api gateway and send notifications
        fetch(gatewayURL, {
          method: "post",
          body: JSON.stringify(opts),
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error!`)
	      }else{
	      console.log("sent --success")
	      }
          })
          .catch((e) => {console.log("e",e)
            console.log("Error encountered sending APN push notification.")
	    })
	    }
      } catch (error) {console.log("error",error)
        console.log(`"Error encountered sending APN push notification"-${error}`)
      }
      break
    case "ios.watch":
      try {
        //preparing curl request
        const opts: any = {
          push_type: "apns",          
          api_key: gatewayApiKey,
          device_token: device_token,
          payload: {
            aps: {
              alert: `${payload.message}`,
              badge: 0,
              sound: "default",
              "mutable-content": 1,
              "content-available": 1,
              "push-type":"background",
              "collapse-id":`${notificationId}`,
              "expiration":10
            },  
            notificationId: `${notificationId}`,
	    
	    
	    
            expiry:21600000,            
            page: `${url}`,
            actions: [{ name: "Open App", page: `${url}` }],
          }
	  }
	   // Collect the Participant's device token, if there is one saved.
          const event_data = await SensorEventRepository._select(
            payload.participant_id,
            "lamp.analytics",
            undefined,
            undefined,
            1000
          )
          let appVersion:any =''
          if (event_data.length !== 0) {
          const filteredArray: any = await event_data.filter(
            (x) => (x.data.type === undefined && x.data.action !== "notification" && x.data.device_type !== "Dashboard")
          )
console.log('filteredArray',filteredArray);
          if (filteredArray.length !== 0) {
          const events: any = filteredArray[0]
	  const device = undefined !== events && undefined !== events.data ? events.data : undefined
	  console.log('2121212devic',device)
          if (device !== undefined ) {
             appVersion = device.user_agent
          }
        }
        }
        //for new
        console.log("appVersion",appVersion);
        let appVersion_:any=''
        if(''!==appVersion )  {
          appVersion_= appVersion.split(',')[0]
        }
        console.log("appVer--==",appVersion);
        if("1.0"===appVersion_ || appVersion.toLowerCase().search('diig')!==-1)  {
            //connect to api gateway and send notifications
        fetch('http://192.168.96.137:3003/push', {
          method: "post",
          body: JSON.stringify(opts),
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error!`)
            }
          })
          .catch((e) => {
            console.log("Error encountered sending APN push notification.")
          })


	  }else{
        //connect to api gateway and send notifications
        fetch(gatewayURL, {
          method: "post",
          body: JSON.stringify(opts),
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error!`)
            }
          })
          .catch((e) => {
            console.log("Error encountered sending APN push notification.")
	    })
	    }
      } catch (error) {
        console.log(`"Error encountered sending APN push notification"-${error}`)
      }
      break
    default:
      break
      }
      } catch (error) {
  console.log(error.message)

}
}
