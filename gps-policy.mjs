/** Conservative browser geolocation filtering and route cooldown policy. */
export function validGpsTimestamp(measuredAt,lastAccepted=0,now=Date.now()){
 return Number.isFinite(measuredAt)&&measuredAt>0&&
  measuredAt>lastAccepted&&measuredAt>=now-30000&&measuredAt<=now+5000;
}
/** Real deviation allows earlier retry, but not unlimited fetches for noisy GPS. */
export function routeCooldownMs(confirmedDeviation=false){return confirmedDeviation?8000:35000;}
