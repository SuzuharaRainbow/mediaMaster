export default function VideoPlayer({src}){
  return <video src={src} controls style={{width:"100%", maxWidth:640}}/>
}