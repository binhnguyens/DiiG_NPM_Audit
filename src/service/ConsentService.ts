import { Request, Response, Router } from "express"
import { ParticipantRepository } from "../repository/ParticipantRepository"
import { ResearcherRepository } from "../repository/ResearcherRepository"
import { StudyRepository } from "../repository/StudyRepository"
import { ConsentRepository } from "../repository/ConsentRepository"
import { SecurityContext as guestSecurityContext, ActionContext as  guestActionContext, _verify as guestVerify } from "./SecurityGuest"
import { SecurityContext, ActionContext, _verify } from "./Security"
import jsonata from "jsonata"
import { EmailQueue } from "../utils/queue/EmailQueue"
import { Consent } from "../model/Consent"
export const ConsentService = Router()
ConsentService.post("/consent/:study_id/participant", async (req: Request, res: Response) => {
  try {
    let study_id = req.params.study_id
    let output:any = {}
    const participant = req.body
    if(!!participant.email) {
    study_id = await guestVerify(req.get("Authorization"), ["self", "sibling", "parent"], study_id)
    let existDetails = await ConsentRepository._select(participant.email,false,true)    
    if(existDetails.length!=0) throw new Error("500.email-already-exists")
    output= { data: await ParticipantRepository._insert(study_id, participant) }
    participant.participant_id =  output['data'].id    
    await ConsentRepository._insert(study_id, participant)
    EmailQueue.add({"origin":participant.participant_id,
                    "access_key":`${participant.participant_id}@lamp.com`,
                    "secret_key":participant.participant_id,"description":"Temporary Login",
                    isVerified:participant.isVerified})  
    participant.study_id = study_id
    participant.action = "create"
    } else {
        throw new Error("500.email-required")
    } 
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
ConsentService.put("/consent/participant/:participant_id", async (req: Request, res: Response) => {
  try {
    let participant_id = req.params.participant_id
    const participant = req.body
    participant_id = await _verify(req.get("Authorization"), ["self", "sibling", "parent"], participant_id)
    const output = { data: await ParticipantRepository._update(participant_id, participant) }
    await ConsentRepository._update(participant_id, participant)    
    EmailQueue.add({"origin":participant_id,
                    "access_key":`${participant_id}@lamp.com`,
                    "secret_key":participant_id,"description":"Temporary Login",
                    isVerified:participant.isVerified})       
    

   
    
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})

ConsentService.get("/consent/participant/:participant_id", async (req: Request, res: Response) => {
    try {      
      let participant_id = req.params.participant_id
      participant_id = await _verify(req.get("Authorization"), ["self", "sibling", "parent"], participant_id)
      let output = { data: await ConsentRepository._select(participant_id) }
      output = typeof req.query.transform === "string" ? jsonata(req.query.transform).evaluate(output) : output
      res.json(output)
    } catch (e) {
      if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
      res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
    }
  })
  ConsentService.get("/consent/researcher", async (req: Request, res: Response) => {
    try {
      const _ = await guestVerify(req.get("Authorization"), [])
      let output = { data: await ResearcherRepository._select() }
      output = typeof req.query.transform === "string" ? jsonata(req.query.transform).evaluate(output) : output
      res.json(output)
    } catch (e) {
      if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
      res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
    }
  })
  ConsentService.get("/consent/:researcher_id/study", async (req: Request, res: Response) => {
    try {
      let researcher_id = req.params.researcher_id
      researcher_id = await guestVerify(req.get("Authorization"), ["self", "parent"], researcher_id)
      let output = { data: await StudyRepository._select(researcher_id, true) }
      output = typeof req.query.transform === "string" ? jsonata(req.query.transform).evaluate(output) : output
      res.json(output)
    } catch (e) {
      if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
      res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
    }
  })
  
  
// TODO: activity/* and sensor/* entry
