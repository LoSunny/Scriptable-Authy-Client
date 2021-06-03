const debugMode = false;

let fileManager;
try {
    fileManager = FileManager.iCloud();
} catch (ex) {
    fileManager = FileManager.local();
}
const dirPath = fileManager.joinPath(fileManager.documentsDirectory(), 'Authy Client');
const configPath = fileManager.joinPath(dirPath, "config.json");
let configuration;

// If I need to use await for importModule, async is required
(async () => {
    if (config.runsInApp) {
        logDebugMsg('Loading config')
        configuration = await initConfig();
        logDebugMsg('Success init config')
        if (configuration.Setup) {
            logDebugMsg('Device is setup')
        } else {
            logDebugMsg('Setting up device')
            await setupDevice()
        }
        await setupTokens()
        console.log('Setup is completed')
    }
})();

// Support for ShortCut app
if (!config.runsInApp) {
    return shortcut();
}

async function shortcut() {
    logDebugMsg('Loading config')
    configuration = await initConfig();
    logDebugMsg('Success init config')
    const params = args.shortcutParameter || args.queryParameters;
    if (params.getTokens != null) {
        return await getTokens();
        Script.complete();
    } else if (params.getToken != null) {
        return await getToken(params.getToken || "");
        Script.complete();
    }
}

// Support for Scriptable
module.exports.getTokens = async () => {
    return await getTokens();
    Script.complete();
}

module.exports.getToken = async name => {
    return await getToken(name);
    Script.complete();
}

async function initConfig() {
    if (!fileManager.fileExists(dirPath)) {
        fileManager.createDirectory(dirPath);
    }
    let config = null;
    if (fileManager.fileExists(configPath)) {
        if (!fileManager.isFileDownloaded(configPath)) {
            await fileManager.downloadFileFromiCloud(configPath);
        }
        config = JSON.parse(fileManager.readString(configPath));
    } else {
        config = {
            "Signature": getRanHex(64),
        }
        saveConfig(config);
    }
    return config;
}

function saveConfig(configuration) {
    fileManager.writeString(configPath, JSON.stringify(configuration))
}

async function setupDevice() {
    // Get country code + verification method
    let phoneNo;
    let errMsg = ""
    while (true) {
        phoneNo = await getPhoneNumber(errMsg);
        if (phoneNo.stop) {
            console.warn("Force stop")
            throw new Error("Force stop")
        } else if (phoneNo.country != null && phoneNo.phoneNo != null) {
            break;
        } else if (phoneNo.country == null && phoneNo.phoneNo == null) {
            errMsg = "Unknown input";
        } else if (phoneNo.country == null || phoneNo.country === "") {
            errMsg = "Unknown country";
        } else if (phoneNo.phoneNo == null || phoneNo.phoneNo === "") {
            errMsg = "Unknown phone number";
        }
    }
    let req = new Request(`https://api.authy.com/json/users/${phoneNo.country}-${phoneNo.phoneNo}/status?api_key=37b312a3d682b823c439522e1fd31c82`);
    const statusResult = await req.loadJSON();
    if (!statusResult.success) {
        console.error('Unknown error occur1');
        console.error(statusResult);
        throw new Error(JSON.stringify(statusResult));
    } else if (statusResult.authy_id == null) {
        console.error('Unknown Authy account')
        throw new Error(JSON.stringify(statusResult));
    }

    // Get verification code
    let method;
    errMsg = "";
    while (true) {
        method = await chooseVerifyMethod(errMsg);
        if (method.stop) {
            console.warn("Force stop")
            throw new Error("Force stop")
        } else if (method.select == null) {
            errMsg = "Unknown method";
        } else
            break;
    }
    let registrationStartReq = new BetterRequest(`https://api.authy.com/json/users/${statusResult.authy_id}/devices/registration/start`);
    registrationStartReq.method = "post";
    registrationStartReq.form = {
        api_key: "37b312a3d682b823c439522e1fd31c82",
        via: method.select,
        device_app: "authy",
        signature: configuration.Signature
    };
    let registrationStartRes = await registrationStartReq.loadJSON();
    if (!registrationStartRes.success) {
        console.error('Unknown error occur2');
        console.error(registrationStartRes);
        throw new Error(JSON.stringify(registrationStartRes));
    }
    let registrationRes;
    while (true) {
        await wait(2000);
        let registrationCheckReq = new Request(`https://api.authy.com/json/users/${statusResult.authy_id}/devices/registration/${registrationStartRes.request_id}/status?api_key=37b312a3d682b823c439522e1fd31c82&signature=${configuration.Signature}`);
        let registrationCheckRes = await registrationCheckReq.loadJSON();
        if (!registrationCheckRes.success) {
            console.error('Unknown error occur3');
            console.error(registrationCheckRes);
            throw new Error(JSON.stringify(registrationCheckRes));
        }
        if (registrationCheckRes.status === "pending")
            continue;
        else if (registrationCheckRes.status === "rejected") {
            console.warn('You should accept the request');
            throw new Error('You should accept the request');
        } else if (registrationCheckRes.status === "accepted") {
            let registrationResultReq = new BetterRequest(`https://api.authy.com/json/users/${statusResult.authy_id}/devices/registration/complete`)
            registrationResultReq.method = "post";
            registrationResultReq.form = {
                api_key: "37b312a3d682b823c439522e1fd31c82",
                pin: registrationCheckRes.pin,
                device_app: "authy",
            };
            registrationRes = await registrationResultReq.loadJSON()
            break;
        } else {
            console.error('Unknown option');
            console.error(registrationCheckRes);
            throw new Error(JSON.stringify(registrationCheckRes));
        }
    }
    configuration["UserID"] = registrationRes.authy_id;
    configuration["DeviceID"] = registrationRes.device.id;
    configuration["Seed"] = registrationRes.device.secret_seed;
    configuration["APIKey"] = registrationRes.device.api_key;
    configuration["Setup"] = true;
    saveConfig(configuration)
}

async function getPhoneNumber(err) {
    return {
        "country": "852",
        "phoneNo": "66718109",
        "stop": false
    }

    const webView = new WebView();
    // We need to use the oninput event to track the user inputs
    await webView.loadHTML(`<html><head><style>body{zoom: 3;}</style></head><body><p>${err}</p><span>Country Code: +</span><input type="number" oninput="country = this.value"><br><span>Phone Number: </span><input type="number" oninput="phoneNo = this.value"><br><a href="javascript:stop = true;">Close</a></body></html>`);
    await webView.evaluateJavaScript(`
        log('Load getPhoneNumber website');
        let country;
        let phoneNo;
        let stop = false;`, false)
    await webView.present();
    // Because when `await webView.present()` is fired, you cannot get back the value with document.getElementByID("country").textContent or .innerHTML for some reason
    const country = await webView.evaluateJavaScript(`country`, false);
    const phoneNo = await webView.evaluateJavaScript(`phoneNo`, false);
    const stop = await webView.evaluateJavaScript(`stop`, false);
    return {
        "country": country,
        "phoneNo": phoneNo,
        "stop": stop
    }
}

async function chooseVerifyMethod(err) {
    const webView = new WebView();
    await webView.loadHTML(`<html><head><style>body{zoom: 3;}</style></head><body><p>${err}</p><p>Verify method</p>
        <select autofocus onchange="select = this.value">
        <option selected="selected" disabled value="null">Select one method</option>
        <option value="sms">SMS</option>
        <option value="call">Voice Call</option>
        <option value="push">By other devices</option>
        </select><br><a href="javascript:stop = true;">Close</a></body></html>`);
    await webView.evaluateJavaScript(`
        log('Load chooseVerifyMethod website');
        let select;
        let stop = false;`, false)
    await webView.present();
    const select = await webView.evaluateJavaScript(`select`, false);
    const stop = await webView.evaluateJavaScript(`stop`, false);
    return {
        "select": select,
        "stop": stop
    }
}

async function setupTokens() {
    const otps = await generateTOTPCodes();
    if (configuration.tokenApps == null) {
        logDebugMsg('Requesting tokenApps')
        let authenticatorAppsReq = new BetterRequest(`https://api.authy.com/json/users/${configuration.UserID}/devices/${configuration.DeviceID}/apps/sync`);
        authenticatorAppsReq.method = "post";
        authenticatorAppsReq.form = {
            "api_key": "37b312a3d682b823c439522e1fd31c82",
            "device_id": configuration.DeviceID,
            "otp1": otps[0],
            "otp2": otps[1],
            "otp3": otps[2],
            "locale": "en-GB"
        };
        let authenticatorAppsRes = await authenticatorAppsReq.loadJSON();
        if (!authenticatorAppsRes.success) {
            console.log('Unknown error occur4');
        }
        configuration.tokenApps = authenticatorAppsRes.apps;
        saveConfig(configuration);
    }

    if (configuration.tokenTokens == null) {
        logDebugMsg('Requesting tokenTokens')
        let authenticatorTokensReq = new Request(`https://api.authy.com/json/users/${configuration.UserID}/authenticator_tokens?api_key=37b312a3d682b823c439522e1fd31c82&device_id=${configuration.DeviceID}&otp1=${otps[0]}&otp2=${otps[1]}&otp3=${otps[2]}&apps=`);
        let authenticatorTokensRes = await authenticatorTokensReq.loadJSON();
        if (!authenticatorTokensRes.success) {
            console.error('Unknown error occur5');
            console.error(registrationCheckRes);
        }
        configuration.tokenTokens = authenticatorTokensRes.authenticator_tokens;
        saveConfig(configuration);
    }
    
    if(configuration.passphase == null){
        let passphase;
        errMsg = "";
        while (true) {
            passphase = await enterPasscode(errMsg);
            if (passphase.stop) {
                console.warn("Force stop")
                throw new Error("Force stop")
            } else if (passphase.password == null) {
                errMsg = "Unknown password";
            } else
                break;
        }
        configuration.passphase = passphase.password;
        saveConfig(configuration)
    }
}

async function getTokens(){
    let result = [];
    for (let i = 0; i < configuration.tokenTokens.length; i++) {
        let code = await decryptTOTPCode(configuration.tokenTokens[i].encrypted_seed, configuration.tokenTokens[i].salt, configuration.passphase);
        result.push({
            Issuer: configuration.tokenTokens[i].issuer,
            Name: configuration.tokenTokens[i].name,
            Code: code
        })
        // console.log(configuration.tokenTokens[i].issuer + configuration.tokenTokens[i].name + ": " + code)
    }
    return result;
}

async function getToken(name) {
    let result = [];
    for (let i = 0; i < configuration.tokenTokens.length; i++) {
        let token = configuration.tokenTokens[i];
        if ((token.issuer != null ? token.issuer.toLowerCase().includes(name.toLowerCase()) : false) || (token.name != null ? token.name.toLowerCase().includes(name.toLowerCase()) : false)) {
            let code = await decryptTOTPCode(token.encrypted_seed, token.salt, configuration.passphase);
            return code;
            break;
        }
    }
    return "Cannot find with the provided name"
}

async function enterPasscode(err) {
    const webView = new WebView();
    await webView.loadHTML(`<html><head><style>body{zoom: 3;}</style></head><body><p>${err}</p><span>Authy Password: </span><input type="password" id="passcode"><br><a href="javascript:stop = true;">Close</a></body></html>`);
    await webView.evaluateJavaScript(`
        log('Load enterPasscode website');
        let stop = false;`, false)
    await webView.present();
    const passcode = await webView.evaluateJavaScript(`document.getElementById("passcode").value`, false);
    const stop = await webView.evaluateJavaScript(`stop`, false);
    return {
        "password": passcode,
        "stop": stop
    }
}

async function generateTOTPCodes(){
    const webView = new WebView();
    await webView.loadHTML(`<html><head><script src="https://unpkg.com/@otplib/preset-browser@^12.0.0/buffer.js"></script><script src="https://unpkg.com/@otplib/preset-browser@^12.0.0/index.js"></script><script>
        function gen(seed) {
            let options = {};
            options["epoch"] = Date.now();
            options["step"] = 10;
            options["digits"] = 7;
            options["encoding"] = "hex";
            window.otplib.totp.options = options;
            const token1 = window.otplib.totp.generate(seed);
            options.epoch = options.epoch + 10000;
            window.otplib.totp.options = options;
            const token2 = window.otplib.totp.generate(seed);
            options.epoch = options.epoch + 10000;
            window.otplib.totp.options = options;
            const token3 = window.otplib.totp.generate(seed);
            return [token1, token2, token3];
        }
        </script></head></html>`);
    return await webView.evaluateJavaScript(`gen("${configuration.Seed}")`, false);
}

async function decryptTOTPCode(seed, salt, passphase){
    const webView = new WebView();
    await webView.loadHTML(`<html><head><script src="https://cdn.jsdelivr.net/npm/node-forge@0.10.0/dist/forge.min.js"></script><script src="https://cdn.jsdelivr.net/gh/emn178/hi-base32@v0.5.1/build/base32.min.js"></script><script>
        function Int64toBytes(num) {
            var arr = new ArrayBuffer(8);
            var view = new DataView(arr);
            view.setUint32(0, num, true);
            return String.fromCharCode(...new Uint8Array(arr).reverse());
        }
        function str2ab(str) {
            var buf = new ArrayBuffer(str.length);
            var bufView = new Uint8Array(buf);
            for (var i=0, strLen=str.length; i<strLen; i++) {
                bufView[i] = str.charCodeAt(i);
            }
            let dataview = new DataView(buf);
            return [buf, bufView, dataview];
        }
        function decrypt(seed, salt, passphase) {
            let encryptedSeed = forge.util.decode64(forge.util.decode64(seed));
            let key = forge.pkcs5.pbkdf2(passphase, salt, 1e3, 32);
            let iv = forge.util.decode64("AAAAAAAAAAAAAAAAAAAAAA==")
            let decipher = forge.cipher.createDecipher('AES-CBC', key);
            decipher.start({iv: iv});
            decipher.update(forge.util.createBuffer(encryptedSeed));
            let result = decipher.finish();
            let decode = base32.decode.asBytes(decipher.output.data.toUpperCase());
            var hmac = forge.hmac.create();
            hmac.start('sha1', decode);
            let time = Int64toBytes(Math.floor(Date.now() / 1000 / 30));
            hmac.update(time);
            let hash = hmac.digest().data;
            hash = str2ab(hash);
            let offset = hash[1][hash[1].length-1] & 15;
            let truncatedHash = hash[2].getUint32(offset) & 0x7FFFFFFF;
            let pinValue = parseInt(truncatedHash % 1000000);
            return pinValue
        }
        </script></head></html>`);
    return await webView.evaluateJavaScript(`decrypt("${Data.fromString(seed).toBase64String()}", "${salt}", "${passphase}")`, false);
}

function logDebugMsg(msg) {
    if (debugMode)
        console.log(msg)
}

function getRanHex(size) {
    let result = [];
    let hexRef = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
    for (let n = 0; n < size; n++) {
        result.push(hexRef[Math.floor(Math.random() * 16)]);
    }
    return result.join('');
}

function wait(sec){
	return new Promise(resolve=>{
		const timer = new Timer();
		timer.timeInterval = sec;
		timer.schedule(()=>{
			resolve();
		})
	});
}

// BetterRequest API taken from https://gist.github.com/schl3ck/2009e6915d10036a916a1040cbb680ac
function encodeURL(url) {
	return url.replace(/[^0-9a-zA-Z]/g, (match) => {
		let hex = match.charCodeAt(0).toString(16);
		if (hex.length % 2 !== 0) hex = "0" + hex;
		return hex.replace(/[\S\s]{2}/g, "%$&");
	});
}

let BetterRequest = (function() {
	
	let stringify = JSON.stringify;
	
	function BetterRequest(url) {
		this.request = new Request(url);
		
		this.headers = {};
		this.body = null;
	}
	
	Object.keys(Request.prototype).forEach(p => {
		if (p === "body" || p === "headers") return;
		
		if (p.includes("load")) {
			BetterRequest.prototype[p] = function() {
// 	 			log("inside " + p)
				convert(this);
// 	 			log(this.request)
				return this.request[p]();
			};
			return;
		}
			Object.defineProperty(BetterRequest.prototype, p, {
			enumerable: true,
			get: function() {
				return this.request[p];
			},
			set: function(value) {
				return this.request[p] = value;
			}
		})
	});
		
	function convert(that) {
// 		log(that.headers["Content-Type"]);
// 		log(that.body, that.json, that.form);
		if (!that.headers["Content-Type"] && typeof (that.body || that.json || that.form) !== "undefined") {
			let contentType;
			if (typeof that.json === "object") {
				that.body = that.json;
			}
			if (typeof that.body === "string") {
				contentType = "text/plain";
			} else if (typeof that.body === "object" && that.body != null && !(that.body instanceof Data)) {
				contentType = "application/json";
				that.body = stringify(that.body);
			} else if (typeof that.form === "object") {
				contentType = "application/x-www-form-urlencoded";
				let ar = [];
// 				log(Object.entries(that.form))
				for (let [k, v] of Object.entries(that.form)) {
// 					log(`entry ${k} = ${v}`);
					
					if (v == null) 
						v = "";
					else if (typeof v === "object")
						v = stringify(v);
					
					ar.push(
						`${encodeURL("" + k)}=${encodeURL("" + v)}`
					);
				}
				that.body = ar.join("&");
			} else if (that.body instanceof Data) {
				contentType = "application/octet-stream";
			}
			
			
			that.headers["Content-Type"] = contentType;
			
			that.request.body = that.body;
		}
		that.request.headers = that.headers;
	}
	
	return BetterRequest;
})();