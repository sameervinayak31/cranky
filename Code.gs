/**
 * Cranky — Google Apps Script backend
 * Bound to your Google Sheet. Deploy as a Web App (see SETUP.md).
 * Responds as JSONP so the GitHub Pages site can call it with no CORS setup.
 *
 * Beans columns: A name | B roaster | C notes | D grind | E grams | F opened | G status | H country | I rating
 */

var GRAMS_PER = 17.5;

var SEED = {
  drink: ['Espresso','Americano','Flat White','Cappuccino','Cortado','Iced Americano',
          'Iced Latte','Iced Flat White','Vanilla Maple Frappe','Iced Cold Foam Americano'],
  barista: ['Payal','Sameer'],
  person: ['Payal','Sameer']
};

function doGet(e){
  var p = (e && e.parameter) || {};
  var out;
  try {
    ensureSetup();
    switch (p.action) {
      case 'getData':      out = getData(); break;
      case 'log':          out = logDrink(p); break;
      case 'addBean':      out = addBean(p); break;
      case 'updateBean':   out = updateBean(p); break;
      case 'addOption':    out = addOption(p); break;
      case 'removeOption': out = removeOption(p); break;
      default:             out = { ok:false, error:'unknown action' };
    }
  } catch (err) {
    out = { ok:false, error:String(err) };
  }
  var body = JSON.stringify(out);
  if (p.callback) body = p.callback + '(' + body + ')';
  return ContentService.createTextOutput(body)
    .setMimeType(p.callback ? ContentService.MimeType.JAVASCRIPT
                            : ContentService.MimeType.JSON);
}

function ss(){ return SpreadsheetApp.getActiveSpreadsheet(); }

function ymd(v){
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v ? String(v) : '';
}

function ensureSetup(){
  var s = ss();
  if (!s.getSheetByName('Log'))
    s.insertSheet('Log').appendRow(['timestamp','barista','for','drink','bean','grams']);
  var beans = s.getSheetByName('Beans');
  if (!beans){
    s.insertSheet('Beans').appendRow(['name','roaster','notes','grind','grams','opened','status','country','rating']);
  } else if (beans.getRange(1,8).getValue() === ''){
    beans.getRange(1,8,1,2).setValues([['country','rating']]);
  }
  var opt = s.getSheetByName('Options');
  if (!opt){
    opt = s.insertSheet('Options');
    opt.appendRow(['category','value']);
    ['drink','barista','person'].forEach(function(cat){
      SEED[cat].forEach(function(v){ opt.appendRow([cat, v]); });
    });
  }
  var def = s.getSheetByName('Sheet1');
  if (def && def.getLastRow()===0) s.deleteSheet(def);
}

function getData(){
  var s = ss();
  var bsheet = s.getSheetByName('Beans'), beans = [];
  if (bsheet.getLastRow() > 1){
    bsheet.getRange(2,1,bsheet.getLastRow()-1,9).getValues().forEach(function(r,i){
      if (r[0]==='' && r[4]==='') return;
      beans.push({ id:i+2, name:r[0], roaster:r[1], notes:r[2], grind:r[3],
                   grams:Number(r[4])||0, opened:ymd(r[5]), status:r[6]||'active',
                   country:r[7]||'', rating:r[8]===''?'':Number(r[8]) });
    });
  }
  var osheet = s.getSheetByName('Options'), options = { drink:[], barista:[], person:[] };
  if (osheet.getLastRow() > 1){
    osheet.getRange(2,1,osheet.getLastRow()-1,2).getValues().forEach(function(r){
      if (options[r[0]] !== undefined && r[1]!=='') options[r[0]].push(r[1]);
    });
  }
  var lsheet = s.getSheetByName('Log'), log = [];
  if (lsheet.getLastRow() > 1){
    lsheet.getRange(2,1,lsheet.getLastRow()-1,6).getValues().forEach(function(r){
      if (!r[0]) return;
      var ts = (r[0] instanceof Date) ? r[0].toISOString() : String(r[0]);
      log.push({ ts:ts, barista:r[1], for:r[2], drink:r[3], bean:r[4], grams:Number(r[5])||0 });
    });
  }
  return { ok:true, beans:beans, options:options, log:log };
}

function logDrink(p){
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var beans = ss().getSheetByName('Beans');
    var row = Number(p.beanId);
    var name = beans.getRange(row,1).getValue();
    var grams = Number(beans.getRange(row,5).getValue()) || 0;   // grams = col E
    var next = Math.round((grams - GRAMS_PER)*10)/10;
    beans.getRange(row,5).setValue(next);
    ss().getSheetByName('Log').appendRow([new Date(), p.barista||'', p.for||'', p.drink||'', name, GRAMS_PER]);
    return { ok:true, beanId:row, grams:next };
  } finally { lock.releaseLock(); }
}

function addBean(p){
  var grams = (p.grams===''||p.grams==null) ? 0 : Number(p.grams);
  var rating = (p.rating===''||p.rating==null) ? '' : Number(p.rating);
  ss().getSheetByName('Beans').appendRow([p.name||'', p.roaster||'', p.notes||'', '', grams, p.opened||'', 'active', p.country||'', rating]);
  return { ok:true };
}

function updateBean(p){
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var beans = ss().getSheetByName('Beans');
    var row = Number(p.id);
    if (p.name    !== undefined) beans.getRange(row,1).setValue(p.name);
    if (p.roaster !== undefined) beans.getRange(row,2).setValue(p.roaster);
    if (p.notes   !== undefined) beans.getRange(row,3).setValue(p.notes);
    if (p.grind   !== undefined) beans.getRange(row,4).setValue(p.grind===''?'':Number(p.grind));
    if (p.grams   !== undefined) beans.getRange(row,5).setValue(Number(p.grams));
    if (p.opened  !== undefined) beans.getRange(row,6).setValue(p.opened);
    if (p.status  !== undefined) beans.getRange(row,7).setValue(p.status);
    if (p.country !== undefined) beans.getRange(row,8).setValue(p.country);
    if (p.rating  !== undefined) beans.getRange(row,9).setValue(p.rating===''?'':Number(p.rating));
    if (p.delta   !== undefined){
      var cur = Number(beans.getRange(row,5).getValue())||0;
      beans.getRange(row,5).setValue(Math.round((cur+Number(p.delta))*10)/10);
    }
    return { ok:true };
  } finally { lock.releaseLock(); }
}

function addOption(p){
  ss().getSheetByName('Options').appendRow([p.category, p.value]);
  return { ok:true };
}

function removeOption(p){
  var opt = ss().getSheetByName('Options');
  var vals = opt.getRange(2,1,Math.max(0,opt.getLastRow()-1),2).getValues();
  for (var i=0;i<vals.length;i++){
    if (vals[i][0]===p.category && String(vals[i][1])===String(p.value)){ opt.deleteRow(i+2); break; }
  }
  return { ok:true };
}
