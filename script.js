/* ===== STATE ===== */
var list=[],ctr={},delIdx=-1,editIdx=-1,isAdmin=false,historyList=[],currentAdmin='';
var SK='surat-keluar-ksp-cusmg-v1',HK='surat-keluar-history-ksp-cusmg-v1',AS='ksp-cusmg-admin-session-v1',AP='1';

/* ===== UTILS ===== */
function today(){return new Date().toISOString().split('T')[0]}
function rom(m){return['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][m-1]}
function fmt(d){
  if(!d)return'';
  var dt=new Date(d+'T00:00:00');
  return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'}).format(dt);
}
function cleanSpaces(v){return(v||'').replace(/\s+/g,' ').trim()}
function cleanText(v){return cleanSpaces((v||'').replace(/[^0-9A-Za-z\s.,'"-]/g,''))}
function cleanPersonName(v){return cleanSpaces((v||'').replace(/[^0-9A-Za-z\s.,'"-]/g,''))}
function filterTextChars(v){return(v||'').replace(/[^0-9A-Za-z\s.,'"-]/g,'')}
function toProperCase(v){return cleanSpaces(v).toLowerCase().replace(/\b[a-z0-9]/g,function(ch){return ch.toUpperCase()})}
function normNomor(v){return cleanSpaces(v).toUpperCase().replace(/\s*/g,'')}
function isValidDateStr(v){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;
  var p=v.split('-'),y=parseInt(p[0],10),m=parseInt(p[1],10),d=parseInt(p[2],10);
  var dt=new Date(y,m-1,d);
  return dt.getFullYear()===y&&dt.getMonth()===(m-1)&&dt.getDate()===d;
}
function isNomorSuratFormat(v){
  return /^\d{4}\/KSP-CUSMG\/KP\/[A-Z0-9-]+\/[IVXLCDM]+\/\d{4}$/i.test(cleanSpaces(v));
}
function fmtDateTime(d){
  if(!d)return'';
  return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(d));
}
function safeFileStamp(){
  var d=new Date();
  return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0');
}
function monthLabel(key){
  var p=(key||'').split('-');
  var m=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return p.length===2?(m[parseInt(p[1],10)-1]+' '+p[0]):key;
}
function escHtml(v){
  return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function lineVal(v){return cleanSpaces(v||'')||'-'}
function summarizeSurat(item){
  return [
    'Nomor: '+lineVal(item.nomor),
    'Tanggal: '+lineVal(fmt(item.tgl)),
    'Departemen: '+lineVal(item.dept),
    'Perihal: '+lineVal(item.per),
    'Tujuan: '+lineVal(item.tuj),
    'Pembuat: '+lineVal(item.pem),
    'Keterangan: '+lineVal(item.ket)
  ].join('\n');
}
function nomorSuratKey(v){
  var raw=cleanSpaces(v).toUpperCase();
  if(!isNomorSuratFormat(raw))return'';
  var p=raw.split('/');
  return [p[0],p[4],p[5]].join('/');
}
function hasDuplicateNomor(nomor,skipIdx){
  var target=normNomor(nomor);
  return list.some(function(s,i){return i!==skipIdx&&normNomor(s.nomor||'')===target});
}
function hasDuplicateNomorSuratKey(nomor,skipIdx){
  var target=nomorSuratKey(nomor);
  if(!target)return false;
  return list.some(function(s,i){return i!==skipIdx&&nomorSuratKey(s.nomor||'')===target});
}
function sanitizeLiveInput(id,mode){
  var el=document.getElementById(id);
  if(!el)return;
  var next=filterTextChars(el.value);
  if(el.value!==next)el.value=next;
}

/* ===== STORAGE ===== */
function save(){try{localStorage.setItem(SK,JSON.stringify(list))}catch(e){}}
function saveHistory(){try{localStorage.setItem(HK,JSON.stringify(historyList))}catch(e){}}
function saveAdminSession(){try{sessionStorage.setItem(AS,JSON.stringify({isAdmin:isAdmin,name:currentAdmin||''}))}catch(e){}}
function load(){
  try{var r=localStorage.getItem(SK);list=r?JSON.parse(r):[];if(!Array.isArray(list))list=[];}catch(e){list=[]}
  try{var h=localStorage.getItem(HK);historyList=h?JSON.parse(h):[];if(!Array.isArray(historyList))historyList=[];}catch(e){historyList=[]}
  try{var a=sessionStorage.getItem(AS),s=a?JSON.parse(a):null;isAdmin=!!(s&&s.isAdmin);currentAdmin=s&&s.name?s.name:'';}catch(e){isAdmin=false;currentAdmin=''}
  rebuildCtr();
}
function rebuildCtr(){
  ctr={};
  list.forEach(function(s){
    var p=(s.tgl||'').split('-'),key=p[0]+'-'+p[1];
    var n=parseInt((s.nomor||'').split('/')[0],10);
    if(!isNaN(n))ctr[key]=Math.max(ctr[key]||0,n);
  });
}

/* ===== NOMOR ===== */
function mkNomor(dept,tgl,seq){
  if(!dept||!tgl)return'\u2014 Lengkapi form di bawah \u2014';
  var p=tgl.split('-'),yr=p[0],mo=p[1];
  var n=seq!==undefined?seq:((ctr[yr+'-'+mo]||0)+1);
  return String(n).padStart(4,'0')+'/KSP-CUSMG/KP/'+dept+'/'+rom(parseInt(mo))+'/'+yr;
}
function seqOf(s){var n=parseInt(((s&&s.nomor)||'').split('/')[0],10);return isNaN(n)?0:n}

/* ===== PREVIEW ===== */
function upv(){
  var dept=document.getElementById('fd').value,tgl=document.getElementById('ft').value;
  var box=document.getElementById('previewBox'),pv=document.getElementById('pv'),pvh=document.getElementById('pvh');
  var ok=!!(dept&&tgl);
  pv.textContent=mkNomor(dept,tgl);
  box.className='preview-box '+(ok?'ready':'incomplete');
  pvh.className='preview-hint '+(ok?'ok':'warn');
  pvh.textContent=ok?'Lengkapi Detail Surat & klik Simpan Surat.':'Pilih tanggal dan departemen agar preview muncul otomatis.';
}

/* ===== TOAST ===== */
function toast(msg,err){
  var t=document.getElementById('toast');
  t.className='toast '+(err?'err':'ok');
  document.getElementById('toast-msg').textContent=msg;
  t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(function(){t.classList.remove('show')},2800);
}

/* ===== ADMIN ===== */
function openAdminLogin(){
  document.getElementById('adminName').value=currentAdmin||'';
  document.getElementById('adminPass').value='';
  document.getElementById('adminModal').classList.add('show');
  setTimeout(function(){(document.getElementById('adminName').value?document.getElementById('adminPass'):document.getElementById('adminName')).focus()},30);
}
function closeAdminLogin(){document.getElementById('adminModal').classList.remove('show')}
function loginAdmin(){
  var adminName=toProperCase(cleanPersonName(document.getElementById('adminName').value));
  document.getElementById('adminName').value=adminName;
  if(!adminName){toast('Nama admin wajib diisi',true);return}
  if(document.getElementById('adminPass').value!==AP){toast('Password admin tidak sesuai',true);return}
  currentAdmin=adminName;
  isAdmin=true;saveAdminSession();closeAdminLogin();updateAdminUI();render();toast('Login admin berhasil');
}
function logoutAdmin(){isAdmin=false;currentAdmin='';saveAdminSession();updateAdminUI();render();closeEdit();closeHistory();closeExportModal();toast('Mode admin dinonaktifkan')}
function updateAdminUI(){
  document.getElementById('adminBtn').style.display=isAdmin?'none':'';
  document.getElementById('historyBtn').style.display=isAdmin?'':'none';
  document.getElementById('adminLogoutBtn').style.display=isAdmin?'':'none';
  document.getElementById('backupTools').style.display=isAdmin?'flex':'none';
}
function addHistoryLog(action,beforeItem,afterItem){
  historyList.unshift({
    action:action||'Edit',
    at:new Date().toISOString(),
    by:currentAdmin||'Admin',
    before:summarizeSurat(beforeItem||{}),
    after:afterItem?summarizeSurat(afterItem):'Data dihapus'
  });
  if(historyList.length>100)historyList=historyList.slice(0,100);
  saveHistory();
}
function renderHistory(){
  var box=document.getElementById('historyList');
  if(!box)return;
  if(!historyList.length){
    box.innerHTML='<div class="empty-row">Belum ada riwayat aktivitas.</div>';
    return;
  }
  box.innerHTML=historyList.map(function(item){
    return '<div class="history-item">'+
      '<div class="history-meta">'+
        '<span class="history-badge">'+(item.action||'Edit')+' oleh '+item.by+'</span>'+
        '<span class="history-time">'+fmtDateTime(item.at)+'</span>'+
      '</div>'+
      '<div class="history-grid">'+
        '<div class="history-block"><div class="history-label">Data Lama</div><div class="history-pre">'+item.before+'</div></div>'+
        '<div class="history-block"><div class="history-label">Data Baru</div><div class="history-pre">'+item.after+'</div></div>'+
      '</div>'+
    '</div>';
  }).join('');
}
function downloadBackup(){
  var payload={
    app:'surat-keluar',
    version:1,
    exportedAt:new Date().toISOString(),
    data:list,
    history:historyList
  };
  var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download='backup-surat-keluar-'+safeFileStamp()+'.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Backup JSON berhasil diunduh');
}
function downloadExcel(){
  var selected=(document.getElementById('exportMonth')||{}).value||'all';
  var filtered=(selected==='all'?list:list.filter(function(item){return(item.tgl||'').slice(0,7)===selected})).slice().reverse();
  var rows=filtered.map(function(item,idx){
    return [
      idx+1,
      fmt(item.tgl),
      item.nomor||'',
      item.per||'',
      item.tuj||'',
      item.pem||'',
      item.ket||''
    ];
  });
  if(!rows.length){toast('Tidak ada data pada periode yang dipilih.',true);return}
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>'+
    '<table border="1"><tr><th>No.</th><th>Tanggal</th><th>Nomor Surat</th><th>Perihal</th><th>Tujuan</th><th>Pembuat</th><th>Keterangan</th></tr>'+
    rows.map(function(row){
      return '<tr>'+row.map(function(cell){return '<td>'+escHtml(cell)+'</td>'}).join('')+'</tr>';
    }).join('')+
    '</table></body></html>';
  var blob=new Blob(['\ufeff',html],{type:'application/vnd.ms-excel'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download='surat-keluar-'+(selected==='all'?'semua':selected)+'-'+safeFileStamp()+'.xls';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  closeExportModal();
  toast('Export Excel berhasil diunduh');
}
function openExportModal(){
  if(!isAdmin){toast('Login sebagai admin untuk export Excel',true);return}
  if(!list.length){toast('Belum ada data untuk diexport.',true);return}
  var select=document.getElementById('exportMonth');
  var map={};
  list.forEach(function(item){var k=(item.tgl||'').slice(0,7);if(k)map[k]=1;});
  var opts=Object.keys(map).sort().reverse();
  select.innerHTML='<option value="all">Semua Data</option>'+opts.map(function(k){return '<option value="'+k+'">'+monthLabel(k)+'</option>';}).join('');
  document.getElementById('exportModal').classList.add('show');
}
function closeExportModal(){
  var modal=document.getElementById('exportModal');
  if(modal)modal.classList.remove('show');
}
function triggerRestoreInput(){
  var input=document.getElementById('restoreFile');
  if(!input)return;
  input.value='';
  input.click();
}
function handleRestoreFile(event){
  var file=event.target.files&&event.target.files[0];
  if(!file)return;
  var reader=new FileReader();
  reader.onload=function(){
    try{
      var parsed=JSON.parse(reader.result);
      if(!parsed||parsed.app!=='surat-keluar'||!Array.isArray(parsed.data)){
        toast('File backup tidak cocok untuk Surat Keluar.',true);
        return;
      }
      list=parsed.data;
      historyList=Array.isArray(parsed.history)?parsed.history:[];
      save();
      saveHistory();
      rebuildCtr();
      render();
      stats();
      upv();
      closeHistory();
      toast('Restore JSON Surat Keluar berhasil');
    }catch(e){
      toast('File JSON tidak valid atau gagal dibaca.',true);
    }
  };
  reader.readAsText(file);
}
function openHistory(){
  if(!isAdmin){toast('Login sebagai admin untuk melihat riwayat aktivitas',true);return}
  renderHistory();
  document.getElementById('historyModal').classList.add('show');
}
function closeHistory(){
  var modal=document.getElementById('historyModal');
  if(modal)modal.classList.remove('show');
}

/* ===== SIMPAN ===== */
function simpan(){
  var dept=document.getElementById('fd').value,tgl=document.getElementById('ft').value,
      per=cleanText(document.getElementById('fp').value),tuj=cleanText(document.getElementById('fj').value),
      pem=toProperCase(cleanPersonName(document.getElementById('fb').value)),ket=cleanText(document.getElementById('fk').value);
  document.getElementById('fp').value=per;
  document.getElementById('fj').value=tuj;
  document.getElementById('fb').value=pem;
  document.getElementById('fk').value=ket;
  if(!tgl){toast('Tanggal wajib diisi',true);return}
  if(!isValidDateStr(tgl)){toast('Tanggal tidak valid. Gunakan format tanggal yang benar.',true);return}
  if(!dept){toast('Kode Departemen wajib dipilih',true);return}
  if(!per){toast('Perihal wajib diisi !',true);return}
  if(!tuj){toast('Tujuan Surat wajib diisi !',true);return}
  if(!pem){toast('Pembuat Surat wajib diisi !',true);return}
  var p=tgl.split('-'),key=p[0]+'-'+p[1];
  ctr[key]=(ctr[key]||0)+1;
  var nomor=mkNomor(dept,tgl,ctr[key]);
  if(hasDuplicateNomor(nomor,-1)||hasDuplicateNomorSuratKey(nomor,-1)){
    ctr[key]-=1;
    toast('Nomor surat terdeteksi sudah ada. Periksa data lama atau ubah penomoran terlebih dahulu.',true);
    return;
  }
  list.push({nomor,tgl,dept,per,tuj,pem,ket});
  save();render();stats();toast('Surat disimpan: '+nomor);rst();
}

/* ===== RESET ===== */
function rst(){
  document.getElementById('ft').value=today();
  ['fd','fp','fj','fb','fk'].forEach(function(id){document.getElementById(id).value=''});
  upv();
}

/* ===== HAPUS ===== */
function askHapus(i){
  if(!isAdmin){toast('Login sebagai admin untuk menghapus surat',true);return}
  delIdx=i;document.getElementById('mn').textContent=list[i].nomor;
  document.getElementById('modal').classList.add('show');
}
function closeM(){delIdx=-1;document.getElementById('modal').classList.remove('show')}
function doHapus(){
  if(delIdx<0)return;
  var beforeItem=JSON.parse(JSON.stringify(list[delIdx]));
  list.splice(delIdx,1);closeM();save();rebuildCtr();render();stats();toast('Surat berhasil dihapus',true);upv();
  addHistoryLog('Hapus',beforeItem,null);
}

/* ===== EDIT ===== */
function openEdit(i){
  if(!isAdmin){toast('Login sebagai admin untuk mengedit surat',true);return}
  editIdx=i;var s=list[i];
  document.getElementById('efn').value=s.nomor||'';
  document.getElementById('eft').value=s.tgl||'';
  document.getElementById('efd').value=s.dept||'';
  document.getElementById('efp').value=s.per||'';
  document.getElementById('efj').value=s.tuj||'';
  document.getElementById('efb').value=s.pem||'';
  document.getElementById('efk').value=s.ket||'';
  document.getElementById('editModal').classList.add('show');
}
function closeEdit(){editIdx=-1;document.getElementById('editModal').classList.remove('show')}
function saveEdit(){
  if(editIdx<0)return;
  var nomor=cleanSpaces(document.getElementById('efn').value).toUpperCase(),tgl=document.getElementById('eft').value,
      dept=document.getElementById('efd').value,per=cleanText(document.getElementById('efp').value),
      tuj=cleanText(document.getElementById('efj').value),pem=toProperCase(cleanPersonName(document.getElementById('efb').value)),
      ket=cleanText(document.getElementById('efk').value);
  document.getElementById('efn').value=nomor;
  document.getElementById('efp').value=per;
  document.getElementById('efj').value=tuj;
  document.getElementById('efb').value=pem;
  document.getElementById('efk').value=ket;
  if(!nomor){toast('Nomor surat wajib diisi',true);return}
  if(!isNomorSuratFormat(nomor)){toast('Format nomor surat tidak valid. Gunakan pola seperti 0001/KSP-CUSMG/KP/GM/IV/2026.',true);return}
  if(!tgl){toast('Tanggal wajib diisi',true);return}
  if(!isValidDateStr(tgl)){toast('Tanggal tidak valid. Gunakan format tanggal yang benar.',true);return}
  if(!dept){toast('Kode departemen wajib dipilih',true);return}
  if(!per){toast('Perihal wajib diisi dan hanya boleh memakai karakter yang didukung.',true);return}
  if(!tuj){toast('Tujuan surat wajib diisi dan hanya boleh memakai karakter yang didukung.',true);return}
  if(!pem){toast('Nama pembuat wajib diisi dan hanya boleh memakai karakter huruf, angka, titik, koma, petik, serta tanda hubung.',true);return}
  if(hasDuplicateNomor(nomor,editIdx)){
    toast('Nomor surat sudah digunakan. Gunakan nomor berbeda.',true);return;
  }
  if(hasDuplicateNomorSuratKey(nomor,editIdx)){
    toast('Nomor urut untuk bulan dan tahun tersebut sudah dipakai, meskipun kode departemen berbeda.',true);return;
  }
  var beforeItem=JSON.parse(JSON.stringify(list[editIdx]));
  list[editIdx]={nomor,tgl,dept,per,tuj,pem,ket};
  addHistoryLog('Edit',beforeItem,list[editIdx]);
  rebuildCtr();save();render();stats();upv();closeEdit();toast('Perubahan surat berhasil disimpan');
}

/* ===== RENDER ===== */
function render(){
  var tb=document.getElementById('tb'),q=document.getElementById('fs').value.trim().toLowerCase();
  var aksiHead=document.querySelector('th[data-col="aksi"]');
  var aksiCol=document.querySelector('col[data-col="aksi-col"]');
  if(aksiHead)aksiHead.style.display=isAdmin?'':'none';
  if(aksiCol)aksiCol.style.display=isAdmin?'':'none';
  var cols=isAdmin?8:7;
  if(!list.length){
    tb.innerHTML='<tr><td colspan="'+cols+'"><div class="empty-row"><div class="empty-ico"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5z"/></svg></div>Belum ada surat tercatat</div></td></tr>';
    return;
  }
  var rows=list.map(function(s,idx){return{s,idx}}).filter(function(item){
    if(!q)return true;
    return [item.s.nomor,item.s.per,item.s.tuj,item.s.pem,item.s.ket,item.s.dept,fmt(item.s.tgl)].join(' ').toLowerCase().indexOf(q)!==-1;
  }).reverse();
  if(!rows.length){
    tb.innerHTML='<tr><td colspan="'+cols+'"><div class="empty-row">Data surat tidak ditemukan</div></td></tr>';
    return;
  }
  tb.innerHTML=rows.map(function(item){
    var s=item.s,i=item.idx;
    var aksi=isAdmin?'<td class="tc"><div class="act-grp"><button class="act-btn" onclick="openEdit('+i+')" title="Edit"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="act-btn del" onclick="askHapus('+i+')" title="Hapus"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button></div></td>':'';
    return '<tr>'+
      '<td class="tc"><span class="nbadge">'+seqOf(s)+'</span></td>'+
      '<td>'+fmt(s.tgl)+'</td>'+
      '<td><span class="badge">'+s.nomor+'</span></td>'+
      '<td title="'+s.per+'">'+s.per+'</td>'+
      '<td title="'+s.tuj+'">'+s.tuj+'</td>'+
      '<td title="'+s.pem+'">'+s.pem+'</td>'+
      '<td title="'+(s.ket||'')+'">'+(s.ket||'-')+'</td>'+
      aksi+
      '</tr>';
  }).join('');
}

/* ===== STATS ===== */
function stats(){
  var now=new Date(),yr=now.getFullYear().toString(),mo=String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('s-bln').textContent=list.filter(function(s){return(s.tgl||'').startsWith(yr+'-'+mo)}).length;
  document.getElementById('s-thn').textContent=list.filter(function(s){return(s.tgl||'').startsWith(yr)}).length;
}

/* ===== INIT ===== */
document.getElementById('ft').value=today();
['fp','fj','fk'].forEach(function(id){
  var el=document.getElementById(id);
  if(el)el.addEventListener('input',function(){sanitizeLiveInput(id,'text')});
});
['fb','efb'].forEach(function(id){
  var el=document.getElementById(id);
  if(el)el.addEventListener('input',function(){sanitizeLiveInput(id,'name')});
});
['efp','efj','efk'].forEach(function(id){
  var el=document.getElementById(id);
  if(el)el.addEventListener('input',function(){sanitizeLiveInput(id,'text')});
});
['efn'].forEach(function(id){
  var el=document.getElementById(id);
  if(el)el.addEventListener('input',function(){el.value=cleanSpaces(el.value).toUpperCase()});
});
load();updateAdminUI();upv();render();stats();
