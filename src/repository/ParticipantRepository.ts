import { Database, numeric_uuid } from "../app"
import { Participant } from "../model/Participant"

export class ParticipantRepository {
  public static async _select(id: string | null, parent: boolean = false): Promise<Participant[]> {
   try {   
    return (
      await Database.use("participant").find({
        selector: id === null ? {} : { [parent ? "#parent" : "_id"]: id },
        sort: [{ timestamp: "asc" }],
        limit: 2_147_483_647 /* 32-bit INT_MAX */,
      })
    ).docs.map((doc: any) => ({
      id: doc._id,
      isVerified:doc.isVerified!==undefined ? doc.isVerified:true,
      consent:doc.consent!==undefined ? doc.consent:false
    }))
         
   } catch (error) {    
    return []
  }
  }
  // eslint-disable-next-line
  public static async _insert(study_id: string, object: Participant): Promise<any> {
    const _id = numeric_uuid()    
    //if (study_id === undefined) throw new Error("404.study-does-not-exist") // FIXME
    try {
      if(undefined!==object.isVerified) {
      await Database.use("participant").insert({
        _id: _id,
        "#parent": study_id,    
        isVerified:object.isVerified,   
        consent:object.isVerified===undefined?undefined:true,
        timestamp: new Date().getTime(),
      } as any)
      
    } else {
      await Database.use("participant").insert({
        _id: _id,
        "#parent": study_id,         
        timestamp: new Date().getTime(),
      } as any)
    }
    } catch (e) {
      console.error(e)
      throw new Error("500.participant-creation-failed")
    }
    return { id: _id }
  }
  // eslint-disable-next-line
  public static async _update(participant_id: string, object: Participant): Promise<{}> {
    const orig: any = await Database.use("participant").get(participant_id)
    await Database.use("participant").bulk({
      docs: [
        {
          ...orig,
          isVerified: object.isVerified
        },
      ],
    })
    return {}
  }
  public static async _delete(participant_id: string): Promise<{}> {
    try {
      const orig = await Database.use("participant").get(participant_id)
      const data = await Database.use("participant").bulk({
        docs: [{ ...orig, _deleted: true }],
      })
      if (data.filter((x) => !!x.error).length > 0) throw new Error()
    } catch (e) {
      console.error(e)
      throw new Error("500.deletion-failed")
    }
    return {}
  }
}
