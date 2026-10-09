const zlib=require('node:zlib');
module.exports=b=>{try{
 let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break}
 if(end<0||b.readUInt16LE(end+4)||b.readUInt16LE(end+6))return false;
 const count=b.readUInt16LE(end+10),offset=b.readUInt32LE(end+16);if(!count||count>10000||offset+b.readUInt32LE(end+12)!==end)return false;
 const entries=new Map();let at=offset,total=0;
 for(let j=0;j<count;j++){
 if(at+46>end||b.readUInt32LE(at)!==0x02014b50)return false;
 const n=b.readUInt16LE(at+28),next=at+46+n+b.readUInt16LE(at+30)+b.readUInt16LE(at+32);if(next>end)return false;
 const name=b.subarray(at+46,at+46+n).toString(),flags=b.readUInt16LE(at+8),method=b.readUInt16LE(at+10),packed=b.readUInt32LE(at+20),size=b.readUInt32LE(at+24),local=b.readUInt32LE(at+42);
 if(entries.has(name)||flags&1||![0,8].includes(method)||local+30>offset||b.readUInt32LE(local)!==0x04034b50)return false;
 const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);if(start+packed>offset)return false;total+=size;if(total>80*1024*1024)return false;
 entries.set(name,{method,packed,size,start});at=next;
 }
 if(at!==end)return false;
 const read=(name,max)=>{const e=entries.get(name);if(!e||e.size>max)throw Error();const raw=b.subarray(e.start,e.start+e.packed),out=e.method===0?raw:zlib.inflateRawSync(raw,{maxOutputLength:max});if(out.length!==e.size)throw Error();return out.toString('utf8')};
 if(read('mimetype',100).replace(/^\uFEFF/,'').trim()!=='application/epub+zip')return false;
 const root=read('META-INF/container.xml',1024*1024).match(/<(?:[\w-]+:)?rootfile\b[^>]*\bfull-path\s*=\s*(["'])(.*?)\1/i);if(!root)return false;
 const name=root[2].replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");return /<(?:[\w-]+:)?package\b/i.test(read(name,2*1024*1024));
}catch{return false}};
