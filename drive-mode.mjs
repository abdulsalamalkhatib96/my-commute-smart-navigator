import {isValidCoordinate} from './nav-core.mjs';
/** Optional browser camera follow. Not lane-level positioning or map matching. */
export function cameraForFix(coordinates,accuracy,heading=null){
  if(!isValidCoordinate(coordinates)||!Number.isFinite(accuracy)||accuracy<0||accuracy>60)return null;
  const camera={center:coordinates,zoom:15.8,pitch:32,duration:850};
  if(Number.isFinite(heading)&&heading>=0&&heading<360)camera.bearing=heading;
  return camera;
}
export function canFollow(now,last,pausedUntil,{driveMode=false,active=false,hidden=false}={}){
  return driveMode&&active&&!hidden&&Number.isFinite(now)&&now>=pausedUntil&&now-last>=2800;
}
