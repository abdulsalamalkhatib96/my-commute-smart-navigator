/** Per-destination observational calibration. Uses ONLY explicitly completed trips, never interrupted stops. */
const median=values=>{
 if(!values.length)return null;
 const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);
 return a.length%2?a[m]:(a[m-1]+a[m])/2;
};
export function etaCalibration(trips,destination,{minSamples=5,maxSamples=60}={}){
 if(!Array.isArray(trips)||!['home','work'].includes(destination))return {status:'insufficient',samples:0};
 const errors=trips.filter(x=>x?.destination===destination&&x.completed===true&&
   Number.isFinite(x.durationSeconds)&&x.durationSeconds>=120&&x.durationSeconds<=14400&&
   Number.isFinite(x.initialEtaSeconds)&&x.initialEtaSeconds>=120&&x.initialEtaSeconds<=14400)
 .slice(-maxSamples).map(x=>x.durationSeconds-x.initialEtaSeconds).filter(x=>Math.abs(x)<=5400);
 if(errors.length<minSamples)return {status:'insufficient',samples:errors.length};
 const biasSeconds=median(errors),madSeconds=median(errors.map(x=>Math.abs(x-biasSeconds)));
 return {status:'observed',samples:errors.length,biasSeconds,madSeconds,
  bufferMinutes:Math.max(3,Math.ceil(1.5*madSeconds/60))};
}
export function adjustedEtaSeconds(providerSeconds,calibration){
 if(!Number.isFinite(providerSeconds)||providerSeconds<60||calibration?.status!=='observed')return null;
 return Math.max(60,Math.round(providerSeconds+calibration.biasSeconds));
}
