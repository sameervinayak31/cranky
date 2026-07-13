/**
 * Cranky — Google Apps Script backend
 * Bound to your Google Sheet. Deploy as a Web App (see SETUP.md).
 * Responds as JSONP so the GitHub Pages site can call it with no CORS setup.
 *
 * Beans columns: A name | B roaster | C notes | D grind | E grams | F opened | G status | H country | I rating | J process | K variety | L roastDate | M cost
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
      case 'setDrinkIcon': out = setDrinkIcon(p); break;
      case 'deleteLog':    out = deleteLog(p); break;
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
  var log = s.getSheetByName('Log');
  if (!log){
    s.insertSheet('Log').appendRow(['timestamp','barista','for','drink','bean','grams','mood']);
  } else if (log.getRange(1,7).getValue() === ''){
    log.getRange(1,7).setValue('mood');
  }
  var beans = s.getSheetByName('Beans');
  if (!beans){
    s.insertSheet('Beans').appendRow(['name','roaster','notes','grind','grams','opened','status','country','rating','process','variety','roastDate','cost']);
  } else if (beans.getRange(1,8).getValue() === ''){
    beans.getRange(1,8,1,2).setValues([['country','rating']]);
  }
  if (beans && beans.getRange(1,10).getValue() === ''){
    beans.getRange(1,10,1,2).setValues([['process','variety']]);
  }
  if (beans && beans.getRange(1,12).getValue() === ''){
    beans.getRange(1,12,1,2).setValues([['roastDate','cost']]);
  }
  var opt = s.getSheetByName('Options');
  if (!opt){
    opt = s.insertSheet('Options');
    opt.appendRow(['category','value']);
    ['drink','barista','person'].forEach(function(cat){
      SEED[cat].forEach(function(v){ opt.appendRow([cat, v]); });
    });
  }
  if (!s.getSheetByName('DrinkIcons'))
    s.insertSheet('DrinkIcons').appendRow(['drink','icon']);
  var def = s.getSheetByName('Sheet1');
  if (def && def.getLastRow()===0) s.deleteSheet(def);
}

function getData(){
  var s = ss();
  var bsheet = s.getSheetByName('Beans'), beans = [];
  if (bsheet.getLastRow() > 1){
    bsheet.getRange(2,1,bsheet.getLastRow()-1,13).getValues().forEach(function(r,i){
      if (r[0]==='' && r[4]==='') return;
      beans.push({ id:i+2, name:r[0], roaster:r[1], notes:r[2], grind:r[3],
                   grams:Number(r[4])||0, opened:ymd(r[5]), status:r[6]||'active',
                   country:r[7]||'', rating:r[8]===''?'':Number(r[8]),
                   process:r[9]||'', variety:r[10]||'', roastDate:ymd(r[11]),
                   cost:r[12]===''?'':Number(r[12]) });
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
    lsheet.getRange(2,1,lsheet.getLastRow()-1,7).getValues().forEach(function(r,i){
      if (!r[0]) return;
      var ts = (r[0] instanceof Date) ? r[0].toISOString() : String(r[0]);
      log.push({ id:i+2, ts:ts, barista:r[1], for:r[2], drink:r[3], bean:r[4], grams:Number(r[5])||0, mood:r[6]||'' });
    });
  }
  var disheet = s.getSheetByName('DrinkIcons'), drinkIcons = {};
  if (disheet.getLastRow() > 1){
    disheet.getRange(2,1,disheet.getLastRow()-1,2).getValues().forEach(function(r){
      if (r[0]!=='' && r[1]!=='') drinkIcons[r[0]] = r[1];
    });
  }
  return { ok:true, beans:beans, options:options, log:log, drinkIcons:drinkIcons };
}

function logDrink(p){
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var beans = ss().getSheetByName('Beans');
    var row = Number(p.beanId);
    var name = beans.getRange(row,1).getValue();
    var grams = Number(beans.getRange(row,5).getValue()) || 0;   // grams = col E
    var next = Math.max(0, Math.round((grams - GRAMS_PER)*10)/10);
    beans.getRange(row,5).setValue(next);
    ss().getSheetByName('Log').appendRow([new Date(), p.barista||'', p.for||'', p.drink||'', name, GRAMS_PER, p.mood||'']);
    return { ok:true, beanId:row, grams:next };
  } finally { lock.releaseLock(); }
}

function addBean(p){
  var grams = (p.grams===''||p.grams==null) ? 0 : Number(p.grams);
  var rating = (p.rating===''||p.rating==null) ? '' : Number(p.rating);
  var cost = (p.cost===''||p.cost==null) ? '' : Number(p.cost);
  ss().getSheetByName('Beans').appendRow([p.name||'', p.roaster||'', p.notes||'', '', grams, p.opened||'', 'active', p.country||'', rating, p.process||'', p.variety||'', p.roastDate||'', cost]);
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
    if (p.grams   !== undefined) beans.getRange(row,5).setValue(Math.max(0, Number(p.grams)));
    if (p.opened  !== undefined) beans.getRange(row,6).setValue(p.opened);
    if (p.status  !== undefined) beans.getRange(row,7).setValue(p.status);
    if (p.country !== undefined) beans.getRange(row,8).setValue(p.country);
    if (p.rating  !== undefined) beans.getRange(row,9).setValue(p.rating===''?'':Number(p.rating));
    if (p.process !== undefined) beans.getRange(row,10).setValue(p.process);
    if (p.variety !== undefined) beans.getRange(row,11).setValue(p.variety);
    if (p.roastDate !== undefined) beans.getRange(row,12).setValue(p.roastDate);
    if (p.cost      !== undefined) beans.getRange(row,13).setValue(p.cost===''?'':Number(p.cost));
    if (p.delta   !== undefined){
      var cur = Number(beans.getRange(row,5).getValue())||0;
      beans.getRange(row,5).setValue(Math.max(0, Math.round((cur+Number(p.delta))*10)/10));
    }
    return { ok:true };
  } finally { lock.releaseLock(); }
}

function deleteLog(p){
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sheet = ss().getSheetByName('Log');
    var row = Number(p.id);
    if (row <= 1 || row > sheet.getLastRow()) return { ok:true };
    var beanName = sheet.getRange(row,5).getValue();
    var grams = Number(sheet.getRange(row,6).getValue()) || GRAMS_PER;
    sheet.deleteRow(row);
    if (beanName){
      var beans = ss().getSheetByName('Beans');
      var last = beans.getLastRow();
      if (last > 1){
        var names = beans.getRange(2,1,last-1,1).getValues();
        for (var i=0;i<names.length;i++){
          if (String(names[i][0])===String(beanName)){
            var br = i+2;
            var cur = Number(beans.getRange(br,5).getValue())||0;
            beans.getRange(br,5).setValue(Math.round((cur+grams)*10)/10);
            break;
          }
        }
      }
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
  if (p.category==='drink') setDrinkIcon({ drink:p.value, icon:'' });
  return { ok:true };
}

function setDrinkIcon(p){
  var sheet = ss().getSheetByName('DrinkIcons');
  var vals = sheet.getRange(2,1,Math.max(0,sheet.getLastRow()-1),2).getValues();
  var rowIdx = -1;
  for (var i=0;i<vals.length;i++){
    if (String(vals[i][0])===String(p.drink)){ rowIdx = i+2; break; }
  }
  if (p.icon===''||p.icon==null){
    if (rowIdx>0) sheet.deleteRow(rowIdx);
  } else if (rowIdx>0){
    sheet.getRange(rowIdx,2).setValue(p.icon);
  } else {
    sheet.appendRow([p.drink, p.icon]);
  }
  return { ok:true };
}
