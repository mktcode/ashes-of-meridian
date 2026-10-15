// Dependency-free ZIP32 / Stored. No decompression, filesystem access or code execution.
const crcTable=(()=>{const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}return table;})();
export function crc32(bytes){let c=0xffffffff;for(let i=0;i<bytes.length;i++)c=crcTable[(c^bytes[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
const check=(ok,message='Ungültiges ZIP-Paket.')=>{if(!ok)throw Error(message);};
const validName=name=>typeof name==='string'&&name.length>0&&name.length<=180&&!/[\\:\x00-\x1f\x7f]/.test(name)&&name.split('/').every(p=>p&&p!=='.'&&p!=='..');
export function checkAbort(signal){if(signal?.aborted)throw Error('Export abgebrochen.');}
export async function zipFiles(files,{signal,maxBytes=0xffffffff}={}) {
  check(files.length>0&&files.length<=65535,'Zu viele ZIP-Dateien.');
  const chunks=[],central=[],names=new Set(),enc=new TextEncoder();let offset=0,centralSize=0;
  for(const [name,content] of files) {
    checkAbort(signal);check(validName(name)&&!names.has(name),'Ungültiger oder doppelter ZIP-Dateiname.');names.add(name);
    let bytes;
    if(content instanceof Blob)bytes=new Uint8Array(await content.arrayBuffer());
    else if(content instanceof ArrayBuffer)bytes=new Uint8Array(content);
    else if(ArrayBuffer.isView(content))bytes=new Uint8Array(content.buffer,content.byteOffset,content.byteLength);
    else {check(typeof content==='string','Nicht unterstützter ZIP-Inhalt.');bytes=enc.encode(content);}
    const filename=enc.encode(name),crc=crc32(bytes),header=new Uint8Array(30+filename.length),h=new DataView(header.buffer);
    check(offset+centralSize+bytes.length+header.length+46+filename.length+22<=maxBytes,'ZIP-Paket überschreitet das Größenlimit.');
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);
    h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,filename.length,true);header.set(filename,30);
    // Preserve Blob parts, rather than retaining another full byte copy of every image.
    chunks.push(header,content instanceof Blob?content:bytes);
    const dir=new Uint8Array(46+filename.length),d=new DataView(dir.buffer);
    d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);
    d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,filename.length,true);d.setUint32(42,offset,true);dir.set(filename,46);
    central.push(dir);centralSize+=dir.length;offset+=header.length+bytes.length;
  }
  checkAbort(signal);
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);
  e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end],{type:'application/zip'});
}

// Strict reader for this exporter: no comments, extras, encryption, descriptors,
// ZIP64, split archives or Deflate. Bound size/count before parsing/allocating.
export async function readZip(input,{maxBytes=2*1024*1024,maxFiles=80,signal}={}) {
  if(input instanceof Blob){check(input.size<=maxBytes,'ZIP-Paket ist zu groß.');input=await input.arrayBuffer();}
  const bytes=input instanceof Uint8Array?input:input instanceof ArrayBuffer?new Uint8Array(input):null;
  check(bytes&&bytes.length>=22&&bytes.length<=maxBytes,'ZIP-Paket ist zu groß oder ungültig.');
  const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),end=bytes.length-22,decode=new TextDecoder('utf-8',{fatal:true});
  check(d.getUint32(end,true)===0x06054b50&&d.getUint16(end+20,true)===0);
  const count=d.getUint16(end+10,true),size=d.getUint32(end+12,true),start=d.getUint32(end+16,true);
  check(d.getUint16(end+4,true)===0&&d.getUint16(end+6,true)===0&&d.getUint16(end+8,true)===count);
  check(count>0&&count<=maxFiles&&start+size===end);
  const files=new Map();let at=start,local=0;
  for(let n=0;n<count;n++) {
    checkAbort(signal);
    check(at+46<=end&&d.getUint32(at,true)===0x02014b50);
    const flags=d.getUint16(at+8,true),method=d.getUint16(at+10,true),crc=d.getUint32(at+16,true),length=d.getUint32(at+20,true),nameLength=d.getUint16(at+28,true);
    check((flags===0x800||flags===0)&&method===0,'Nur ZIP/Stored ohne Verschlüsselung wird unterstützt.');
    check(length===d.getUint32(at+24,true)&&d.getUint16(at+30,true)===0&&d.getUint16(at+32,true)===0&&d.getUint16(at+34,true)===0);
    check(d.getUint32(at+42,true)===local&&at+46+nameLength<=end&&local+30<=start);
    const name=decode.decode(bytes.subarray(at+46,at+46+nameLength));
    check(validName(name)&&!files.has(name),'Unsicherer oder doppelter ZIP-Dateiname.');
    check(d.getUint32(local,true)===0x04034b50&&d.getUint16(local+6,true)===flags&&d.getUint16(local+8,true)===method);
    check(d.getUint32(local+14,true)===crc&&d.getUint32(local+18,true)===length&&d.getUint32(local+22,true)===length);
    check(d.getUint16(local+26,true)===nameLength&&d.getUint16(local+28,true)===0);
    const dataStart=local+30+nameLength,dataEnd=dataStart+length;
    check(dataEnd<=start&&decode.decode(bytes.subarray(local+30,dataStart))===name);
    const data=bytes.subarray(dataStart,dataEnd);check(crc32(data)===crc,'ZIP-Prüfsumme stimmt nicht: '+name);
    files.set(name,data);local=dataEnd;at+=46+nameLength;
    if(length>1024*1024)await new Promise(resolve=>setTimeout(resolve,0));
  }
  check(local===start&&at===end);return files;
}
