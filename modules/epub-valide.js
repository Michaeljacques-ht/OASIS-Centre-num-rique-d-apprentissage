module.exports=b=>{try{
 if(b.length<58||b.readUInt32LE(0)!==0x04034b50||b.readUInt16LE(6)!==0||b.readUInt16LE(8)!==0)return false;
 const n=b.readUInt16LE(26),x=b.readUInt16LE(28);if(b.subarray(30,30+n).toString()!=='mimetype'||b.readUInt32LE(18)!==20||b.subarray(30+n+x,50+n+x).toString()!=='application/epub+zip')return false;
 let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break}if(end<0||b.readUInt16LE(end+4)||b.readUInt16LE(end+6))return false;
 const count=b.readUInt16LE(end+10),size=b.readUInt32LE(end+12),offset=b.readUInt32LE(end+16);if(!count||count>10000||offset+size!==end)return false;
 let i=offset,container=false,packageFile=false;
 for(let j=0;j<count;j++){if(i+46>end||b.readUInt32LE(i)!==0x02014b50)return false;const nameSize=b.readUInt16LE(i+28),extra=b.readUInt16LE(i+30),comment=b.readUInt16LE(i+32),local=b.readUInt32LE(i+42);if(local+30>offset||b.readUInt32LE(local)!==0x04034b50)return false;const name=b.subarray(i+46,i+46+nameSize).toString();if(name==='META-INF/container.xml')container=true;if(name.endsWith('.opf'))packageFile=true;i+=46+nameSize+extra+comment;if(i>end)return false;}
 return container&&packageFile&&i===end;
 }catch{return false}};
