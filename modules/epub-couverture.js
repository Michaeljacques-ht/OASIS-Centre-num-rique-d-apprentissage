// Lecture bornée des entrées ZIP, sans extraction sur le disque ni accès réseau.
const zlib=require('node:zlib'),path=require('node:path').posix;
module.exports=b=>{try{
 let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){end=i;break}if(end<0)return null;
 const entries=new Map();let at=b.readUInt32LE(end+16),count=b.readUInt16LE(end+10);if(count>10000)return null;
 for(let j=0;j<count;j++){if(b.readUInt32LE(at)!==0x02014b50)return null;const n=b.readUInt16LE(at+28),extra=b.readUInt16LE(at+30),comment=b.readUInt16LE(at+32);entries.set(b.subarray(at+46,at+46+n).toString(),{method:b.readUInt16LE(at+10),size:b.readUInt32LE(at+24),packed:b.readUInt32LE(at+20),local:b.readUInt32LE(at+42),flags:b.readUInt16LE(at+8)});at+=46+n+extra+comment;}
 const read=(name,max)=>{const e=entries.get(name);if(!e||e.size>max||e.flags&1)return null;const a=e.local+30+b.readUInt16LE(e.local+26)+b.readUInt16LE(e.local+28);if(a+e.packed>b.length)return null;const raw=b.subarray(a,a+e.packed);return e.method===0?raw:e.method===8?zlib.inflateRawSync(raw,{maxOutputLength:max}):null;};
 const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
 const attrs=s=>Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(m=>[m[1],decode(m[3])]));
 const container=read('META-INF/container.xml',1048576)?.toString();const packageName=attrs(container?.match(/<(?:\w+:)?rootfile\b[^>]*>/i)?.[0]||'')['full-path'];if(!packageName)return null;
 const opf=read(packageName,2097152)?.toString();if(!opf)return null;
 const items=[...opf.matchAll(/<(?:\w+:)?item\b[^>]*>/gi)].map(m=>attrs(m[0]));const coverId=[...opf.matchAll(/<(?:\w+:)?meta\b[^>]*>/gi)].map(m=>attrs(m[0])).find(a=>a.name==='cover')?.content;
 const chosen=items.find(a=>(a.properties||'').split(/\s+/).includes('cover-image'))||items.find(a=>a.id===coverId)||items.find(a=>/^image\//.test(a['media-type']||'')&&/cover/i.test(a.id+' '+a.href));if(!chosen?.href)return null;
 const name=path.normalize(path.join(path.dirname(packageName),decodeURIComponent(chosen.href.split('#')[0])));const data=read(name,5*1024*1024);if(!data)return null;
 const mime=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':data[0]===255&&data[1]===216&&data[2]===255?'image/jpeg':data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'?'image/webp':null;
 return mime?{data,mime}:null;
 }catch{return null}};
