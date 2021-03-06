import { Request, Response, Router } from "express"
import { Activity } from "../model/Activity"
import { ActivityRepository } from "../repository/ActivityRepository"
import { SecurityContext, ActionContext, _verify } from "./Security"
import jsonata from "jsonata"
import { UpdateToSchedulerQueue } from "../utils/queue/UpdateToSchedulerQueue"
import { DeleteFromSchedulerQueue } from "../utils/queue/DeleteFromSchedulerQueue"
import { TypeRepository } from "../repository"
import { PubSubAPIListenerQueue } from "../utils/queue/PubSubAPIListenerQueue"

export const ActivityService = Router()
ActivityService.post("/study/:study_id/activity", async (req: Request, res: Response) => {
  try {
    let study_id = req.params.study_id
    const activity = req.body
    study_id = await _verify(req.get("Authorization"), ["self", "sibling", "parent"], study_id)
    const output = { data: await ActivityRepository._insert(study_id, activity) }
    activity.study_id = study_id
    activity.action = "create"
    activity.settings = undefined
    activity.schedule = undefined
    activity.photo = undefined



    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
ActivityService.put("/activity/:activity_id", async (req: Request, res: Response) => {
  try {
    let activity_id = req.params.activity_id
    const activity = req.body
    activity_id = await _verify(req.get("Authorization"), ["self", "sibling", "parent"], activity_id)
    const output = { data: await ActivityRepository._update(activity_id, activity) }
    UpdateToSchedulerQueue.add({ activity_id: activity_id })
    activity.activity_id = activity_id
    activity.action = "update"
    activity.settings = undefined
    activity.schedule = undefined
    activity.photo = undefined
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
ActivityService.delete("/activity/:activity_id", async (req: Request, res: Response) => {
  try {
    let activity_id = req.params.activity_id
    let parent: any = ""
    //find the study id before delete, as it cannot be fetched after delete 
    try {
      parent = await TypeRepository._parent(activity_id)
    } catch (error) {
      console.log("Error fetching Study")
    }
    activity_id = await _verify(req.get("Authorization"), ["self", "sibling", "parent"], activity_id)
    const output = { data: await ActivityRepository._delete(activity_id) }
    DeleteFromSchedulerQueue.add({ activity_id: activity_id })

    
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
ActivityService.get("/activity/:activity_id", async (req: Request, res: Response) => {
  try {
    let activity_id = req.params.activity_id
    activity_id = await _verify(req.get("Authorization"), ["self", "sibling", "parent"], activity_id)
    let output = { data: await ActivityRepository._select(activity_id) }
    output = typeof req.query.transform === "string" ? jsonata(req.query.transform).evaluate(output) : output
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
ActivityService.get("/participant/:participant_id/activity", async (req: Request, res: Response) => {
  try {
    let participant_id = req.params.participant_id
    participant_id = await _verify(req.get("Authorization"), ["self", "sibling", "parent"], participant_id)
    let study_id = await TypeRepository._owner(participant_id)
    if (study_id === null) throw new Error("403.invalid-sibling-ownership")
    let output = { data: await ActivityRepository._select(study_id, true) }
    output = typeof req.query.transform === "string" ? jsonata(req.query.transform).evaluate(output) : output
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
ActivityService.get("/study/:study_id/activity", async (req: Request, res: Response) => {
  try {
    let study_id = req.params.study_id
    study_id = await _verify(req.get("Authorization"), ["self", "sibling", "parent"], study_id)
    let output = { data: await ActivityRepository._select(study_id, true) }
    output = typeof req.query.transform === "string" ? jsonata(req.query.transform).evaluate(output) : output
    res.json(output)
  } catch (e) {
    if (e.message === "401.missing-credentials") res.set("WWW-Authenticate", `Basic realm="LAMP" charset="UTF-8"`)
    res.status(parseInt(e.message.split(".")[0]) || 500).json({ error: e.message })
  }
})
