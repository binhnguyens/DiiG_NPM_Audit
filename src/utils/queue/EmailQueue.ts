import Bull from "bull"
import sgMail from "@sendgrid/mail"
import { CredentialRepository } from "../../repository/CredentialRepository"
import { ConsentRepository } from "../../repository/ConsentRepository" 
import { Mutex } from "async-mutex"
const clientLock = new Mutex()

//Initialise UpdateToSchedulerQueue Queue
export const EmailQueue = new Bull("Email", process.env.REDIS_HOST ?? "")

EmailQueue.process(async (job: any, done: any) => {
  //locking the thread
  const release = await clientLock.acquire()

  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY??'')
    if(job.data.isVerified!==undefined) {
        if(job.data.isVerified) {
            //set up credentials
            delete job.data.isVerified                        
            await CredentialRepository._insert(job.data.origin,job.data)
            let consent = await ConsentRepository._select(job.data.origin)
            console.log("consent-details",consent)
            if(!!consent[0].email) {
            //send email to the participant
            const msg:any = {
              to: consent[0].email, // Change to your recipient
              from: process.env.SENDGRID_API_FROM_ADDR, // Change to your verified sender
              subject: 'DiiG Consent Signup Success',
              text: 'DiiG',              
              html: `<p>Hi ${consent[0].first_name} ${consent[0].last_name},</p><p>You have been successfully registered into Diig app. Please find the credentials below:</p><br><p>Username:${job.data.origin}@lamp.com</p><p>Password:${job.data.origin}</p><br><br> <p>Regards,</p><p>walter.sim@unityhealth.to,</p><p>unityhealth, Canada</p>`,
            }
           
sgMail
  .send(msg)
  .then(() => {
    console.log('Email sent')
  })
  .catch((error) => {
    console.error(error)
  })
  
}
        }
      }
    release()
   
  } catch (error) {
    //release the lock for thread
    release()
    console.log(`released job on exception- ${job.data.activity_id}`)
  }
  done()

})
