"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XRegion = void 0;
const os = require("os");
const fs = require("fs");
const path = require("path");
const xload_1 = require("./xload");
var XRegion;
(function (XRegion) {
    let JSONX;
    (function (JSONX) {
        JSONX.write_file = (stream, data) => {
            if (!stream || !data) {
                return false;
            }
            if (os.platform() == "win32") {
                stream.write(`\xEF\xBB\xBF`, "binary");
            }
            let text = JSON.stringify(data, null, "\t");
            stream.write(text);
            return true;
        };
    })(JSONX = XRegion.JSONX || (XRegion.JSONX = {}));
    let TS;
    (function (TS) {
        TS.write_file = (stream, data) => {
            if (!stream || !data) {
                return false;
            }
            if (os.platform() == "win32") {
                stream.write(`\xEF\xBB\xBF`, "binary");
            }
            let text = JSON.stringify(data, null, "\t");
            text = text.replace(/`/g, "'");
            stream.write(`const XREGION_TEXT = \`${text}\`;${os.EOL}`);
            stream.write(`const XREGION_LIST = JSON.parse(XREGION_TEXT);${os.EOL}`);
            stream.write(`export let XRegionText = XREGION_TEXT;${os.EOL}`);
            stream.write(`export let XRegionList = XREGION_LIST;${os.EOL}`);
            stream.write(`
            // 不以空格为分割符
            export let XRegionToArray = (text:string) => {
                let values = text.trim().split(/[/|,|:|;]/i);
                if(!values || values.length == 0) {
                    return null;
                } else if(values.length == 1 && values[0].length == 0) {
                    return null;
                }
                values.forEach((v, i, a) => {
                    a[i] = v.trim();
                });
                return values;
            }
			export let XRegionToAny = (text:string, sep:string = ",") => {
				let values = XRegionToArray(text);
				if(!values || values.length == 0) {
					return { country: null, region: null };
				}
				if(values.length < 1) {
					return { country: values[0], region: null };
				}
				values = values.slice(1);
				return { country: values[0], region: values.join(sep) };
			}
            export let XRegionToText = (values:Array<string>, sep:string = ",") => {
                if(!values || values.length == 0) {
                    return "";
                }
                return values.join(sep);
            }
			export let XRegionFromAny = (country:string|null, region:string|null, sep:string = ",") => {
				if(!country) { return null; }
				if(!region) { return [country] }
				
				let values = [country, region];
				let value = XRegionToText(values, sep);

				// 重新格式化
				return XRegionToArray(value);
			}
            export let XRegionParse = (values:Array<string>|null, key:string = "name") => {
				if(!values || values.length == 0) { return null; }
				
				let country:any = null;
				let country_list:Array<any> = XREGION_LIST.list;
				for(let i in country_list) {
					if(i == "count" || i == "length") { continue; }

					let v = country_list[i];
					if(!v[key]) { continue; }
					if(v[key] == values[0]) {
						country = { ...v };
						break;
					}
				}

				if(!country) {
					return null;
				}

				let province:any = null;
				if(values.length > 1) {
					let province_list = country.list;
					for(let i in province_list) {
						if(i == "count" || i == "length") { continue; }

						let v = province_list[i];
						if(!v[key]) { continue; }
						if(v[key] == values[1]) {
							province = { ...v };
							break;
						}
					}
				}

				let city:any = null;
				if(province && values.length > 2) {
					let city_list = province.list;
					for(let i in city_list) {
						if(i == "count" || i == "length") { continue; }

						let v = city_list[i];
						if(!v[key]) { continue; }
						if(v[key] == values[2]) {
							city = { ...v };
							break;
						}
					}
				}

				delete country?.list;
				delete province?.list;
				delete city?.list;
				return { country:country, province:province, city:city };
			}
            ${os.EOL}
            `);
            return true;
        };
    })(TS = XRegion.TS || (XRegion.TS = {}));
    let load_region_from_file = (mode, id, filename, data) => {
        if (id < 0 || !(data === null || data === void 0 ? void 0 : data.list) || !data.list[id]) {
            return false;
        }
        if (!fs.existsSync(filename)) {
            return false;
        }
        let result = xload_1.XLoadFile.load_from_file(mode, filename, { index: "id" });
        if (!result) {
            return false;
        }
        let cid = -1;
        let region_for_id = { count: 0 };
        let region_for_name = { count: 0 };
        for (let i in result.list) {
            let v = result.list[i];
            if (v.cid == id) {
                delete v.cid;
                let province = Object.assign({}, v);
                delete province.type;
                delete province.code;
                delete province.zip;
                delete province.city;
                delete province.city_chn;
                province.desc = null;
                let city = Object.assign({}, v);
                delete city.name;
                delete city.name_chn;
                delete city.short;
                delete city.short_chn;
                city.name = city.city;
                city.name_chn = city.city_chn;
                delete city.city;
                delete city.city_chn;
                let last = region_for_name[v.name];
                if (!last) {
                    province.list = { count: 0 };
                    province.list[city.id] = city;
                    province.list.count++;
                    region_for_id[v.id] = province;
                    region_for_name[v.name] = province;
                    region_for_id.count++;
                    region_for_name.count++;
                    last = province;
                }
                else {
                    last.list[city.id] = city;
                    last.list.count++;
                    region_for_id[last.id].list = last.list;
                }
                if (city.type == 1) {
                    last.code = city.code;
                    last.zip = city.zip;
                    last.desc = city.desc;
                }
            }
        }
        ;
        data.list[id].list = region_for_id;
        return true;
    };
    XRegion.load_from_file = (mode, filename) => {
        let fullname = path.resolve(process.cwd(), filename);
        if (!fs.existsSync(fullname)) {
            return null;
        }
        let dirname = path.dirname(fullname);
        try {
            let data = xload_1.XLoadFile.load_from_file(mode, filename, { index: "id" });
            if (!data) {
                console.error("Error");
                return -1;
            }
            let files = fs.readdirSync(dirname);
            files = files.filter((v) => { return /^\d+-region/i.test(v); });
            for (let i = 0; i < files.length; i++) {
                let name = files[i];
                let tempname = path.resolve(process.cwd(), name);
                let id = (/^\d+/i.exec(name) || [-1])[0];
                load_region_from_file(mode, id, tempname, data);
            }
            return data;
        }
        catch (e) {
            return null;
        }
    };
    XRegion.save_to_file = (mode, data, filename) => {
        let fullname = path.resolve(process.cwd(), filename);
        try {
            let encoding = "utf8";
            let stream = fs.createWriteStream(fullname, { flags: 'w', encoding: encoding, });
            if (stream) {
                if (mode == "JSON") {
                    JSONX.write_file(stream, data);
                }
                else if (mode == "TS") {
                    TS.write_file(stream, data);
                }
                else {
                }
                stream.close();
            }
            return true;
        }
        catch (e) {
            return false;
        }
    };
})(XRegion = exports.XRegion || (exports.XRegion = {}));
//# sourceMappingURL=xregion.js.map