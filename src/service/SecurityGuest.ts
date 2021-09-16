import jwt from 'jsonwebtoken'
export function SecurityContext(): Promise<{ type: string; id: string }> {
  return Promise.resolve({ type: "", id: "" })
}

export function ActionContext(): Promise<{ type: string; id: string }> {
  return Promise.resolve({ type: "", id: "" })
}

export async function _verify(
  authHeader: string | undefined,
  type: Array<"self" | "sibling" | "parent"> /* 'root' = [] */,
  auth_value?: string
): Promise<string> {
    let authVal:any
  if(authHeader?.startsWith("Bearer")) {
    
    console.log("Its a bearer authentication")
    const privateKey:any = process.env.JWT_KEY  
    const token= authHeader.split(" ")[1]
    console.log("tokens",token)
    try {
      if(jwt.verify(token,privateKey)) {
        authVal = auth_value        
      }
      return authVal
    } catch (error) {
        throw new Error("403.invalid-credentials")
    }    
  }
  throw new Error("403.invalid-credentials")
  
	    
	
}
