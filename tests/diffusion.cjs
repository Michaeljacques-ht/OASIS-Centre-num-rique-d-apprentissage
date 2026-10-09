const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawn}=require('node:child_process');const vm=require('node:vm');
const source=path.resolve(__dirname,'..');const temp=fs.mkdtempSync(path.join(os.tmpdir(),'oasis-fusion-test-'));let server;let base;
async function start(){server=spawn(process.execPath,['server.js'],{cwd:temp,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});base=await new Promise((ok,no)=>{let output='';server.stdout.on('data',c=>{output+=c;const match=output.match(/TEST_PORT:(\d+)/);if(match)ok('http://127.0.0.1:'+match[1])});server.on('error',no);server.on('exit',code=>no(Error('Server exit '+code)))});}
async function stop(){if(server&&!server.killed){const done=new Promise(r=>server.once('exit',r));server.kill();await done}}
async function request(route,token,method='GET',body){const r=await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {code:r.status,data:await r.json()}}
(async()=>{try{
 fs.cpSync(source,temp,{recursive:true,filter:p=>!['data','integrations','tests','node_modules'].includes(path.relative(source,p).split(path.sep)[0])});
 let code=fs.readFileSync(path.join(temp,'server.js'),'utf8');code=code.replace('http.createServer(async (req, res) => {','const testServer = http.createServer(async (req, res) => {').replace("}).listen(PORT, () => {","}).listen(PORT, () => { console.log('TEST_PORT:' + testServer.address().port);");fs.writeFileSync(path.join(temp,'server.js'),code);await start();
 assert.equal((await request('/diffusion/ressources')).code,401);
 assert.equal((await request('/version')).data.apercuGratuit,true);
 const login=async(email,motDePasse)=>{const r=await request('/connexion',null,'POST',{email,motDePasse});assert.equal(r.code,200);return r.data.jeton};
 const learner=await login('emma@oasis.ht','demo123');const admin=await login('admin@oasis.ht','admin123');
 const seed=await request('/diffusion/ressources',learner);assert.equal(seed.data.length,36);assert(seed.data.every(r=>r.statut==='exemple'&&!r.contenu&&!r.lien));
 const body={titre:'Leçon de test <script>',categorie:'pedagogie',public:'enseignants',statut:'brouillon',contenu:'Contenu de test',description:'Décrire & expliquer'};
 assert.equal((await request('/diffusion/ressources',learner,'POST',{...body,statut:'publie'})).code,403);
 const created=await request('/diffusion/ressources',admin,'POST',body);assert.equal(created.code,201);const id=created.data.id;
 assert(!(await request('/diffusion/ressources',learner)).data.some(r=>r.id===id));
 assert.equal((await request('/diffusion/suivi/'+id,learner,'PUT',{favori:true})).code,404);
 assert.equal((await request('/diffusion/ressources/'+id,admin,'PUT',{...body,statut:'publie',contenu:'',lien:''})).code,400);
 assert.equal((await request('/diffusion/ressources/'+id,admin,'PUT',{...body,lien:'javascript:alert(1)'})).code,400);
 assert.equal((await request('/diffusion/ressources/'+id,admin,'PUT',{...body,statut:'publie'})).code,200);
 assert.equal((await request('/diffusion/suivi/'+id,learner,'PUT',{favori:true,termine:true,note:'Mes notes privées'})).code,200);
 assert.equal((await request('/diffusion/suivi/'+seed.data[0].id,learner,'PUT',{termine:true})).code,400);
 assert.equal((await request('/diffusion/ressources',admin)).data.find(r=>r.id===id).suivi.note,'');
 assert.equal((await request('/diffusion/plans',learner,'POST',{titre:'Révision',date:'2026-10-10'})).code,201);
 assert.equal((await request('/diffusion/plans',admin)).data.length,0);
 const other=await request('/inscription',null,'POST',{nom:'Autre apprenant',email:'test@example.com',motDePasse:'test123456'});assert.equal(other.code,201);const otherToken=other.data.jeton;
 const submission=await request('/diffusion/ressources',learner,'POST',{...body,titre:'Contribution',statut:'soumis'});assert.equal(submission.code,201);assert(!(await request('/diffusion/ressources',otherToken)).data.some(r=>r.id===submission.data.id));assert((await request('/diffusion/ressources',admin)).data.some(r=>r.id===submission.data.id));assert.equal((await request('/diffusion/ressources/'+submission.data.id,otherToken,'PUT',{...body,statut:'soumis'})).code,403);
 const plan=(await request('/diffusion/plans',learner)).data[0];assert.equal((await request('/diffusion/plans/'+plan.id,otherToken,'DELETE')).code,404);
 const book=(await request('/livres',admin,'POST',{titre:'Document test',auteur:'Auteur',categorie:'Sciences',type:'numerique'})).data;
 assert.equal((await request('/livres/'+book.id,admin,'PUT',{titre:'Titre modifié',niveau:'NS4',editeur:'OASIS'})).code,200);
 const epubPath=path.join(temp,'test.epub');require('child_process').execFileSync('python3',['-c',"import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('mimetype','application/epub+zip'); z.writestr('META-INF/container.xml','<container/>'); z.writestr('content.opf','<package/>'); z.close()",epubPath]);
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
 const updated=(await request('/livres/'+book.id,learner)).data;assert(updated.epub&&updated.versionNumerique);assert.equal(updated.titre,'Titre modifié');
 assert.equal((await fetch(base+'/api/livres/'+book.id+'/epub',{method:'POST',headers:{Authorization:'Bearer '+admin},body:'not an epub'})).status,400);
 const resources=(await request('/diffusion/ressources',learner)).data;
 // Exécute le rendu client avec le fonds réel et vérifie la navigation interne et l'échappement.
 const mount={innerHTML:'',events:{},addEventListener(n,fn){this.events[n]=fn},contains(){return true},querySelector(s){return this.nodes[s]||(this.nodes[s]={innerHTML:'',textContent:''})},nodes:{}};
 const context={window:{},document:{getElementById:()=>mount},console,FormData};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(source,'public/diffusion.js'),'utf8'),context);const client=context.window.OasisDiffusion;
 const api=async(route)=>route.endsWith('plans')?[plan]:resources;
 for(const tab of ['pedagogie','methodes','td','parcours','outils']){await client.render(api,false,tab);client.mount();assert(mount.innerHTML.includes('oasisDiffusion'));assert(mount.nodes['.diff-body'].innerHTML.length>50)}
 await client.render(api,false,'pedagogie');client.mount();assert(mount.nodes['.diff-body'].innerHTML.includes('&lt;script&gt;'));assert(!mount.nodes['.diff-body'].innerHTML.includes('Leçon de test <script>'));
 for(const r of seed.data.filter(r=>r.image)){assert.equal((await fetch(base+r.image)).status,200)}
 for(const asset of ['/diffusion.js?v15','/styles.css?v15','/admin','/'])assert.equal((await fetch(base+asset)).status,200);
 await stop();await start();const l2=await login('emma@oasis.ht','demo123');assert.equal((await request('/diffusion/ressources',l2)).data.find(r=>r.id===id).suivi.note,'Mes notes privées');assert.equal((await request('/diffusion/plans',l2)).data.length,1);assert.equal((await request('/livres',l2)).code,200);
 console.log('OK : import, connexion commune, droits, brouillons, publication, liens, suivi privé, planning privé, persistance, rendu des 5 rubriques et bibliothèque existante.');
 }finally{await stop();fs.rmSync(temp,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
