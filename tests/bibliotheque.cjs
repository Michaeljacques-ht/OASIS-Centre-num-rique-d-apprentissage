const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');const vm=require('node:vm');
const source=path.resolve(__dirname,'..');const temp=fs.mkdtempSync(path.join(os.tmpdir(),'oasis-fusion-test-'));let server;let base;
async function start(){server=spawn(process.execPath,['server.js'],{cwd:temp,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});base=await new Promise((ok,no)=>{let output='';server.stdout.on('data',c=>{output+=c;const match=output.match(/TEST_PORT:(\d+)/);if(match)ok('http://127.0.0.1:'+match[1])});server.on('error',no);server.on('exit',code=>no(Error('Server exit '+code)))});}
async function stop(){if(server&&!server.killed){const done=new Promise(r=>server.once('exit',r));server.kill();await done}}
async function request(route,token,method='GET',body){const r=await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {code:r.status,data:await r.json()}}
(async()=>{try{
 fs.cpSync(source,temp,{recursive:true,filter:p=>!['data','integrations','tests','node_modules'].includes(path.relative(source,p).split(path.sep)[0])});
 let code=fs.readFileSync(path.join(temp,'server.js'),'utf8');code=code.replace('http.createServer(async (req, res) => {','const testServer = http.createServer(async (req, res) => {').replace("}).listen(PORT, () => {","}).listen(PORT, () => { console.log('TEST_PORT:' + testServer.address().port);");fs.writeFileSync(path.join(temp,'server.js'),code);await start();
 const login=async(email,motDePasse)=>{const r=await request('/connexion',null,'POST',{email,motDePasse});assert.equal(r.code,200);return r.data.jeton};
 const learner=await login('emma@oasis.ht','demo123');const admin=await login('admin@oasis.ht','admin123');
 const book=(await request('/livres',admin,'POST',{titre:'Document test',auteur:'Auteur',categorie:'Sciences',type:'numerique'})).data;
 assert.equal((await request('/livres/'+book.id,admin,'PUT',{titre:'Titre modifié',niveau:'NS4',editeur:'OASIS'})).code,200);
 const epubPath=path.join(temp,'test.epub');require('child_process').execFileSync('python3',['-c',"import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('mimetype','application/epub+zip'); z.writestr('META-INF/container.xml','<container><rootfiles><rootfile full-path=\"content.opf\"/></rootfiles></container>'); z.writestr('content.opf','<package><manifest><item id=\"cover\" href=\"cover.png\" media-type=\"image/png\" properties=\"cover-image\"/></manifest></package>'); z.writestr('cover.png',bytes([137,80,78,71,13,10,26,10])); z.close()",epubPath]);
 const upload=await fetch(base+'/api/livres/'+book.id+'/epub',{method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/epub+zip'},body:fs.readFileSync(epubPath)});assert.equal(upload.status,201);
 const download=await fetch(base+'/api/livres/'+book.id+'/epub',{headers:{Authorization:'Bearer '+admin}});assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),fs.readFileSync(epubPath));
 assert.equal((await fetch(base+'/api/livres/'+book.id+'/epub',{headers:{Authorization:'Bearer '+learner}})).status,402);
 assert.equal((await request('/livres')).code,200);
 const {PDFDocument}=require('../modules/pdf-lib');const pdf=await PDFDocument.create();for(let i=0;i<8;i++)pdf.addPage().drawText('Page '+(i+1));
 const pdfBook=(await request('/livres',admin,'POST',{titre:'PDF huit pages',auteur:'Test',categorie:'Sciences'})).data;
 const putPdf=await fetch(base+'/api/livres/'+pdfBook.id+'/pdf',{method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/pdf'},body:Buffer.from(await pdf.save())});assert.equal(putPdf.status,201);
 const preview=await fetch(base+'/api/livres/'+pdfBook.id+'/apercu');assert.equal(preview.status,200);assert.equal((await PDFDocument.load(await preview.arrayBuffer())).getPageCount(),5);
 assert.equal((await fetch(base+'/api/livres/'+pdfBook.id+'/pdf')).status,402);
 assert.equal((await fetch(base+'/api/livres/'+pdfBook.id+'/pdf',{headers:{Authorization:'Bearer '+learner}})).status,402);
 const updated=(await request('/livres/'+book.id,learner)).data;assert(updated.epub&&updated.versionNumerique&&updated.couverture);assert.equal((await fetch(base+'/api/livres/'+book.id+'/couverture')).headers.get('content-type'),'image/png');assert.equal(updated.titre,'Titre modifié');
 assert.equal((await fetch(base+'/api/livres/'+book.id+'/epub',{method:'POST',headers:{Authorization:'Bearer '+admin},body:'not an epub'})).status,400);

 assert.equal((await request('/diffusion/ressources',admin)).code,404);
 for(const name of ['index.html','admin.html','app.js','admin.js'])assert(!fs.readFileSync(path.join(source,'public',name),'utf8').includes('OasisDiffusion'));
 console.log('OK : catalogue, métadonnées, EPUB, aperçu PDF protégé et retrait de la section.');
 }finally{await stop();fs.rmSync(temp,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
