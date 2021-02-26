// NOTE: 不需要考虑前端
// TXT：为退格键区分
// 引号中换行符 (不支持)，
// 引号中使用'"' (支持), 引号中出现退格键将被替换为两个英文空格
// 如果引号同时出现在开始和结束，将被移除

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// GBK必须用第三方库转码
import * as iconv from 'iconv-lite';


//
// 命名空间
export namespace XLoadFile {
    //
    export interface XDATA {
        index: string; //pkey
        count?: number;
        list?: Array<any>;
    };


    let decode_string = (buffer:Buffer, length:number, encoding:"auto"|"utf8"|"utf16le" = "utf8") => {
        if(length < 0) { length = buffer.length; }

        if(encoding == "utf8") {
            return buffer.toString("utf8", 0, length);
        } else if(encoding == "utf16le") {
            if(iconv.encodingExists("utf-16le")) {
                return iconv.decode(buffer.subarray(0, length), "utf-16le");
            }
            return buffer.toString("utf16le", 0, length);
        }

        if(os.platform() == "win32") {
            if(iconv.encodingExists("gb2312")) {
                return iconv.decode(buffer.subarray(0, length), "gb2312");
            }
        }

        return buffer.toString("utf8", 0, length);
    }

    // \n 0x0A 是换行符.windows 为\r\n, 其它平台为\n
    let indexof_line_end = (buffer:Buffer, wide:number = 1) => {
        let index = -1;
        for(let i = 0; i < buffer.length; i += wide) {
            let v = 0;
            if(wide == 2) {
                v = (buffer[i + 0] << 0x00) | (buffer[i + 1] << 0x08);
            } else {
                v = buffer[i + 0];
            }

            if(v == 0x0A) {
                index = i;
                break;
            }
        }

        if(index >= 0) {
            if(wide == 2 && buffer.length >= index + 2
                && ((buffer[index + 0] << 0x00) | (buffer[index + 1] << 0x08)) == 0x0A) {
                index += 2;
            } else if(buffer.length >= index + 1 && buffer[index + 0] == 0x0A) { 
                index += 1;
            }
        }
        return index;
    }

    export let read_file_header = (fd:number, length:number) => {
        if(fd < 0) { return null; }

        let encoding:"auto"|"utf8"|"utf16le" = "utf8";
        if(os.platform() == "win32") {
            encoding = "auto";
        }
        let offset = 0;

        //
        let buffer = Buffer.alloc(4, 0);
        if(length >= 2) {
            fs.readSync(fd, buffer, { offset:0, length: 2, position:0 });
            let flag = buffer.readUInt16LE();
            if(flag == 0xFEFF) {
                encoding = "utf16le"; offset += 2;
            } else if (length >= 3) {
                fs.readSync(fd, buffer, { offset:0, length: 3, position:0 });
                flag = buffer.readUInt32LE();
                if(flag == 0x00BFBBEF) { 
                    encoding = "utf8"; offset += 3;
                }
            }
        }

        return { encoding:encoding, offset: offset };
    }

    // 
    export let read_line_from_file = (fd:number, offset:number, encoding:"auto"|"utf8"|"utf16le" = "utf8") => {
        let charwide = 1;
        if(encoding == "utf16le") {
            charwide = 2;
        }

        let block = 256;
        let value:string|null = null;
        let buffer = Buffer.alloc(block, 0);

        let result = -1;
        let ov = 0, op = offset;
        while((result = fs.readSync(fd, buffer, { offset: ov, length: block, position: op })) > 0) {
            let index = indexof_line_end(buffer, charwide);
            if(index >= 0) {
                offset = offset + index;
                value = decode_string(buffer, index, encoding);
                break;
            }
            
            let temp = Buffer.alloc(buffer.length + block, 0);
            buffer.copy(temp, 0, 0);
            buffer = temp;

            // 没有换行符，再读一个块
            ov = ov + block;
            op = op + block;
        }
        
        if(result <= 0 && ov > 0) {
            offset = offset + ov;
            value = decode_string(buffer, -1, encoding);
        }

        return !value ? null: {value:value.replace(/[\r|\n]/g, ""), offset:offset};
    }

    // CSV
    export namespace CSV {

        // 检测双引号是否成匹配
        let check_quota = (text:string) => {
            let count = 0;
            let pos = -1, ov = 0;
            while((pos = text.indexOf("\"", ov)) >= 0) {
                count ++;
                ov = pos + 1;
            }
            return count;
        }

        export let parse_fields = (text:string) => {
            let list:Array<any> = [];
            if(!text || text.length == 0) {
                return list;
            }

            let len = text.length;
            let pos = -1, ov = 0;
            let vv = "";
            while((pos = text.indexOf(",", ov)) >= 0 || ov < len) {
                let n = pos >= 0 ? pos : len;
                let v = text.substring(ov, n).trim();
                
                vv = `${vv}${v}`;
                let qn = check_quota(vv);
                // 用两个英文空格替换原退格键
                if(qn % 2 > 0 && v.length == 0) {
                    vv = `${vv}  `;
                }

                // 括号不是一对一匹配，需要查找下一个
                if(qn % 2 == 0 || n == len) {
                    // 移除开始与结束的"，如果引号在中间并不移除
                    if(vv.startsWith("\"") && vv.endsWith("\"")) { 
                        vv = vv.substring(1, vv.length - 1); 
                    }

                    list.push(vv);
                    vv = "";
                }

                ov = n + 1;
            }
            return list;
        }

        export let load_from_file_impl = (fd:number, length:number, data?:any) => {
            if(fd < 0) { return false; }

            let header = read_file_header(fd, length);
            if(!header) {
                return false;
            }
            let encoding = header.encoding;
            let offset = header.offset;

            //
            let head:Array<string>|null = [];
            if(data instanceof Array) {
                head = null;
            } else {
                data.count = 0;
                data.list = new Array<any>();
            }

            let line:any = null;
            let count:number = 0;
            while((line = read_line_from_file(fd, offset, encoding))) {
                let value = parse_fields(line.value || "");
                if(count == 0 && head) {
                    head = value; 
                    // 格式化字段名
                    for(let i = 0; i < head.length; i ++) {
                        head[i] = head[i].replace(/[-| |\/]/g, "_").toLowerCase();
                    }
                } else if(head) {
                    let ikey:string = data.index || "";
                    let item:any = {};
                    for(let i = 0; i < head.length; i ++) {
                        item = { ...item, ...{[head[i]]:value[i] || null} };
                    }
                    if(ikey.length > 0) {
                        data.list[item[ikey]] = item;
                    } else {
                        data.list.push(item);
                    }
                } else {
                    data.push(value);
                }
                count ++; offset = line.offset;
            }

            if(head) {
                data.count = count - 1;
            }
            return true;
        }
    }
    // TXT
    export namespace TXT {

        // 检测双引号是否成匹配
        let check_quota = (text:string) => {
            let count = 0;
            let pos = -1, ov = 0;
            while((pos = text.indexOf("\"", ov)) >= 0) {
                count ++;
                ov = pos + 1;
            }
            return count;
        }

        export let parse_fields = (text:string) => {
            let list:Array<any> = [];
            if(!text || text.length == 0) {
                return list;
            }

            let len = text.length;
            let pos = -1, ov = 0;
            let vv = "";
            while((pos = text.indexOf("\t", ov)) >= 0 || ov < len) {
                let n = pos >= 0 ? pos : len;
                let v = text.substring(ov, n).trim();
                
                vv = `${vv}${v}`;
                let qn = check_quota(vv);
                // 用两个英文空格替换原退格键
                if(qn % 2 > 0 && v.length == 0) {
                    vv = `${vv}  `;
                }

                // 括号不是一对一匹配，需要查找下一个
                if(qn % 2 == 0 || n == len) {
                    // 移除开始与结束的"，如果引号在中间并不移除
                    if(vv.startsWith("\"") && vv.endsWith("\"")) { 
                        vv = vv.substring(1, vv.length - 1); 
                    }

                    list.push(vv);
                    vv = "";
                }

                ov = n + 1;
            }
            return list;
        }

        export let load_from_file_impl = (fd:number, length:number, data?:any) => {
            if(fd < 0) { return false; }

            let header = read_file_header(fd, length);
            if(!header) {
                return false;
            }
            let encoding = header.encoding;
            let offset = header.offset;

            //
            let head:Array<string>|null = [];
            if(data instanceof Array) {
                head = null;
            } else {
                data.count = 0;
                data.list = new Array<any>();
            }

            let line:any = null;
            let count:number = 0;
            while((line = read_line_from_file(fd, offset, encoding))) {
                let value = parse_fields(line.value || "");
                if(count == 0 && head) {
                    head = value; 
                    // 格式化字段名
                    for(let i = 0; i < head.length; i ++) {
                        head[i] = head[i].replace(/[-| |\/]/g, "_").toLowerCase();
                    }
                } else if(head) {
                    let ikey:string = data.index || "";
                    let item:any = {};
                    for(let i = 0; i < head.length; i ++) {
                        item = { ...item, ...{[head[i]]:value[i] || null} };
                    }
                    if(ikey.length > 0) {
                        data.list[item[ikey]] = item;
                    } else {
                        data.list.push(item);
                    }
                } else {
                    data.push(value);
                }
                count ++; offset = line.offset;
            }

            if(head) {
                data.count = count - 1;
            }
            return true;
        }
    
    }



    export let load_from_file = <TT>(mode:"TXT"|"CSV", filename:string, result:TT) : TT | null => {
        let fullname = path.resolve(process.cwd(), filename);
        if(!fs.existsSync(fullname)) {
            return null;
        }

        let fd:number = -1;

        try {
            let stat = fs.statSync(fullname, {bigint: false});
            let length = stat.size as number;

            fd = fs.openSync(fullname, "r", 0o666);
            if(fd < 0) { return null; }

            let data = result;
            if(mode == "TXT") {
                if(!TXT.load_from_file_impl(fd, length, data)) {
                    fs.closeSync(fd); fd = -1;
                    return null;
                }
            } else {
                if(!CSV.load_from_file_impl(fd, length, data)) {
                    fs.closeSync(fd); fd = -1;
                    return null;
                }
            }

            fs.closeSync(fd); fd = -1;
            return data;
        } catch(e) {
            if(fd >= 0) {
                fs.closeSync(fd); fd = -1;
            }
            return null;
        }
    }
}