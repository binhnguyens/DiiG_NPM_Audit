import Bull from "bull"
import { sendNotification } from "./SchedulerQueue"
import { TypeRepository } from "../../repository"
//Initialise UpdateToSchedulerQueue Queue
export const PushNotificationQueue = new Bull("PushNotification", process.env.REDIS_HOST ?? "")

PushNotificationQueue.process(async (job: any) => {  
let shouldSend:any=true
  try {
    const notificationSettings = await TypeRepository._get("a",job.data.payload.participant_id,"to.unityhealth.psychiatry.settings")         
    if(!notificationSettings.notification) {
      shouldSend=false
    }
  } catch (error) {
    
  }
  if (shouldSend) {
     job.data.payload.url = `/participant/${job.data.payload.participant_id}`
     sendNotification(job.data.device_token, job.data.device_type, job.data.payload)
  }


})
