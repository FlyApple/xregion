
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import {XLoadFile} from "./xload";


// 命名空间
export namespace XRegion {
    // TXT
    export namespace JSONX {
        export let write_file = (stream:fs.WriteStream, data?:any) => {
            if(!stream || !data) {
                return false;
            }
    
            if(os.platform() == "win32") {
                stream.write(`\xEF\xBB\xBF`, "binary");
            }
            
            let text = JSON.stringify(data, null, "\t");
            stream.write(text);
            return true;
        }
    
    }

    let load_region_from_file = (mode:"TXT"|"CSV", id:number, filename:string, data:any) => {
        if(id < 0 || !data?.list || !data.list[id]) {
            return false;
        }

        if(!fs.existsSync(filename)) {
            return false;
        }

        let result = XLoadFile.load_from_file<any>(mode, filename, {index:"id"});
        if(!result) {
            return false;
        }
        
        let cid = -1;
        result.list.forEach((v) => {
            cid = v.cid;
            delete v.cid;
        });
        if(cid != id) {
            return false;
        }

        data.list[id].list = result.list;
        return true;
    }

    export let load_from_file = (mode:"TXT"|"CSV", filename:string) => {
        let fullname = path.resolve(process.cwd(), filename);
        if(!fs.existsSync(fullname)) {
            return null;
        }

        let dirname = path.dirname(fullname);
        try {
            let data = XLoadFile.load_from_file<any>(mode, filename, {index:"id"});
            if(!data) {
                console.error("Error");
                return -1;
            }

            let files = fs.readdirSync(dirname);
            files = files.filter((v) => { return /^\d+-region/i.test(v); });
            for(let i = 0; i < files.length; i ++) {
                let name = files[i];
                let tempname = path.resolve(process.cwd(), name);
                let id = (/^\d+/i.exec(name) || [-1])[0] as number;
                
                load_region_from_file(mode, id, tempname, data);
            }
            return data;
        } catch(e) {
            return null;
        }
    }

    export let save_to_file = (mode:"JSON", data, filename:string) => {
        let fullname = path.resolve(process.cwd(), filename);

        try {
            let encoding:"utf8"|"utf16le" = "utf8";

            let stream = fs.createWriteStream(fullname, { flags: 'w', encoding: encoding, });
            if(stream) {
                if(mode == "JSON") {
                    JSONX.write_file(stream, data);
                } else {
                    //XIPLibrary.write_csv_file(stream, data);
                }
                stream.close();
            }
            return true;
        } catch(e) {
            return false;
        }
    }
}