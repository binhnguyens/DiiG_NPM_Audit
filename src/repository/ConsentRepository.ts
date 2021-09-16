import { Database, uuid } from "../app"
import { Consent } from "../model/Consent"

export class ConsentRepository {
    public static async _select(id: string | null, parent: boolean = false,email=false): Promise<Consent[]> {
        try {  
          if(email) {
            return (
              await Database.use("consent").find({
                selector:{email:id},
                sort: [{ timestamp: "asc" }],
                limit: 2_147_483_647 /* 32-bit INT_MAX */,
              })
            ).docs.map((doc: any) => ({
               id: doc._id,
               ...doc,
               _id: undefined,
               _rev: undefined,
               "#parent": undefined,
               timestamp: undefined,
            }))

          } else {    
 
         return (
           await Database.use("consent").find({
             selector: id === null ? {} : { [parent ? "#parent" : "_id"]: id },
             sort: [{ timestamp: "asc" }],
             limit: 2_147_483_647 /* 32-bit INT_MAX */,
           })
         ).docs.map((doc: any) => ({
            id: doc._id,
            ...doc,
            _id: undefined,
            _rev: undefined,
            "#parent": undefined,
            timestamp: undefined,
         }))
        }
        } catch (error) {    
            console.log('error',error)
         return []
       }
       }
  // eslint-disable-next-line
  public static async _insert(study_id: string, object: Consent): Promise<any> {
    //if (study_id === undefined) throw new Error("404.study-does-not-exist") // FIXME
    try {
      await Database.use("consent").insert({
        _id: object.participant_id,
        "#parent": study_id, 
        first_name:object.first_name??'',
        last_name:object.last_name??'',
        email:object.email,
        age:object.age??'',  
        gender:object.gender??'',  
        isVerified:object.isVerified,        
        timestamp: new Date().getTime(),
      } as any)
      
    
    } catch (e) {
      console.error(e)
      throw new Error("500.participant-creation-failed")
    }
    return { id: object.participant_id }
  }
  // eslint-disable-next-line
  public static async _update(participant_id: string, object: Consent): Promise<{}> {
    const orig: any = await Database.use("consent").get(participant_id)
    await Database.use("consent").bulk({
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
    throw new Error("503.unimplemented")
  }
}
