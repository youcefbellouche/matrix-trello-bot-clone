import { OAuth } from "oauth";
import config from "../config";
import { LogService } from "matrix-js-snippets";
import TrelloToken from "../db/models/TrelloToken";
import * as querystring from "querystring";

class _OAuth {
    private oauth: any;
    private oauthSecrets: { [token: string]: { secret: string, callback: (username: string, token: string, tokenSecret: string) => void } } = {};

    constructor() {
        let cbUrl = "https://lrl-trello-bot.onrender.com";
        if (cbUrl.endsWith("/")) cbUrl = cbUrl.substring(0, cbUrl.length - 1);
        cbUrl = cbUrl + "/api/v1/oauth/callback";
        this.oauth = new OAuth("https://trello.com/1/OAuthGetRequestToken", "https://trello.com/1/OAuthGetAccessToken", "3ddefdadc32f6d100144284fbf11ff0d", "7ed39e8dc2b0cbcb71468433b453a64c445c24dfb49bf73cf8c9a2de1187c905", "1.0A", cbUrl, "HMAC-SHA1");
    }

    public getAuthUrl(callback: (username: string, token: string, tokenSecret: string) => void): Promise<string> {
        return new Promise((resolve, _reject) => {
            this.oauth.getOAuthRequestToken((error, token, tokenSecret, results) => {
                this.oauthSecrets[token] = {secret: tokenSecret, callback: callback};
                resolve("https://trello.com/1/OAuthAuthorizeToken?oauth_token=" + token + "&name=testapi&expiration=never&scope=read,write");
            });
        });
    }

    public verifyCallback(token: string, verifier: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const oauthSecret = this.oauthSecrets[token];

            if (!oauthSecret) {
                reject("Invalid token");
                return;
            }

            this.oauth.getOAuthAccessToken(token, oauthSecret.secret, verifier, (error, accessToken, accessTokenSecret, results) => {
                if (error) {
                    LogService.error("Webserver", error);
                    reject("Internal server error");
                    return;
                }
                // In a real app, the accessToken and accessTokenSecret should be stored
                this.oauth.getProtectedResource("https://api.trello.com/1/members/me", "GET", accessToken, accessTokenSecret, (_error, data, response) => {
                    if (_error) {
                        LogService.error("Webserver", _error);
                        reject("Internal server error");
                        return;
                    }

                    data = JSON.parse(data);
                    delete this.oauthSecrets[token];
                    oauthSecret.callback(data["fullName"], accessToken, accessTokenSecret);
                    resolve();
                });
            });
        });
    }

    public authedGet(token: TrelloToken, endpoint: string, qs: any = {}): Promise<any> {
        endpoint += "?" + querystring.stringify(qs);
        return new Promise((resolve, reject) => {
            this.oauth.get("https://api.trello.com" + endpoint, token.token, token.tokenSecret, (err, data, response) => {
                if (typeof data === "string") data = JSON.parse(data);
                if (!err) resolve(data);
                else reject(err);
            });
        });
    }

    public authedDelete(token: TrelloToken, endpoint: string, qs: any = {}): Promise<any> {
        endpoint += "?" + querystring.stringify(qs);
        return new Promise((resolve, reject) => {
            this.oauth.delete("https://api.trello.com" + endpoint, token.token, token.tokenSecret, (err, data, response) => {
                if (typeof data === "string") data = JSON.parse(data);
                if (!err) resolve(data);
                else reject(err);
            });
        });
    }

    public authedPost(token: TrelloToken, endpoint: string, body: any, qs: any = {}): Promise<any> {
        endpoint += "?" + querystring.stringify(qs);
        return new Promise((resolve, reject) => {
            this.oauth.post("https://api.trello.com" + endpoint, token.token, token.tokenSecret, JSON.stringify(body), "application/json", (err, data, response) => {
                if (typeof data === "string") data = JSON.parse(data);
                if (!err) resolve(data);
                else reject(err);
            });
        });
    }

    public authedPut(token: TrelloToken, endpoint: string, body: any, qs: any = {}): Promise<any> {
        endpoint += "?" + querystring.stringify(qs);
        return new Promise((resolve, reject) => {
            this.oauth.put("https://api.trello.com" + endpoint, token.token, token.tokenSecret, JSON.stringify(body), "application/json", (err, data, response) => {
                if (typeof data === "string") data = JSON.parse(data);
                if (!err) resolve(data);
                else reject(err);
            });
        });
    }
}

export const OAuthHandler = new _OAuth();
