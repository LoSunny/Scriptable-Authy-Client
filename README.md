# Scriptable Authy Client

An authy client which acts as a "device" when "multi-device" is enabled

## How to setup?
1. Download the `Authy Client.js` to `Scriptable`
2. Or by using [scriptdu.de](https://scriptdu.de/?name=Authy%20Client&source=https://raw.githubusercontent.com/LoSunny/Scriptable-Authy-Client/main/Authy%2520Client.js&docs=https://github.com/LoSunny/Scriptable-Authy-Client)
3. Run the script and follow the instructions
4. You're done

## How to use?
### Using Shortcuts
1. Run the shortcut with "Dictionary" pass as an argument
2. In the dictionary, the key can be "getToken" or "getTokens"
3. If the key is "getToken", the value is the item that you are searching for (If multiple items match, it will return the first item)
4. If the key is "getTokens", it will return a JSON which has a list of tokens, including the Issuer, Name and Token
#### Example
![](https://raw.githubusercontent.com/LoSunny/Scriptable-Authy-Client/main/docs/shortcut-gettoken.gif)
![](https://raw.githubusercontent.com/LoSunny/Scriptable-Authy-Client/main/docs/shortcut-gettokens.gif)

### Using Scriptable
1. Import the module with `imoprtModule("Authy Client")`
2. Run `.getToken(name)` to get the token with the given name
3. Or run `.getTokens()` to get a list of tokens in JSON format which has a list of tokens, including the Issuer, Name and Token
#### Example
![](https://raw.githubusercontent.com/LoSunny/Scriptable-Authy-Client/main/docs/scriptable-gettoken.PNG)
![](https://raw.githubusercontent.com/LoSunny/Scriptable-Authy-Client/main/docs/scriptable-gettokens.png)
