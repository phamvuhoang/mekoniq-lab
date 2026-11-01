export interface RuntimeIdentity {sourceCommit:string;schemaHash:string;protocolMajor:number;}
export function verifyRuntime(lock:RuntimeIdentity,actual:RuntimeIdentity):{ok:boolean;reasons:string[]} {
 const reasons:string[]=[];
 if(lock.sourceCommit!==actual.sourceCommit) reasons.push('SOURCE_MISMATCH');
 if(lock.schemaHash!==actual.schemaHash||lock.protocolMajor!==actual.protocolMajor) reasons.push('CONTRACT_MISMATCH');
 return {ok:reasons.length===0,reasons};
}
