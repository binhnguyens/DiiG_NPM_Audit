import { Identifier, Timestamp } from "./Type"
import { Study } from "./Study"
import { Researcher } from "./Researcher"
export class Consent {
  public first_name?:String
  public last_name?:String
  public email?:String
  public age?:String
  public gender?:String  
  public isVerified?: Boolean
  public participant_id?: String
}
