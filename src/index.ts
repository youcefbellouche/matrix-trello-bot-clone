import { AutojoinRoomsMixin, AutojoinUpgradedRoomsMixin, MatrixClient, SimpleRetryJoinStrategy } from "matrix-bot-sdk";
import config from "./config";
import { LogService } from "matrix-js-snippets";
import { LocalstorageStorageProvider } from "./LocalstorageStorageProvider";
import { TrelloStore } from "./db/TrelloStore";
import { CommandProcessor } from "./CommandProcessor";
import { WebhookProcessor } from "./notifications/WebhookProcessor";
import { BotOptionsManager } from "./BotOptionsManager";
import { RoomAnnouncer } from "./notifications/RoomAnnouncer";

LogService.configure(config.logging);
const storageProvider = new LocalstorageStorageProvider(config.dataPath);
const client = new MatrixClient("https://matrix.lrl.chat", "syt_dGVzdF90cmVsbG8_GwnNcEpBCSiCUfiWmeSF_2875Fh", storageProvider);
const optionsManager = new BotOptionsManager(client);
const commands = new CommandProcessor(client, optionsManager);
const announcer = new RoomAnnouncer(client, optionsManager);
const processor = new WebhookProcessor(announcer);

AutojoinRoomsMixin.setupOnClient(client);
AutojoinUpgradedRoomsMixin.setupOnClient(client);
client.setJoinStrategy(new SimpleRetryJoinStrategy());

async function finishInit() {
    const userId = await client.getUserId();
    LogService.info("index", "Trello bot logged in as " + userId);

    await TrelloStore.updateSchema();

    client.on("room.upgraded", async (newRoomId, event) => {
        const oldRoomId = event['content']['predecessor']['room_id'];

        const oldOptions = await optionsManager.getRoomOptions(oldRoomId);
        await optionsManager.setRoomOptions(newRoomId, oldOptions);
        return client.sendNotice(newRoomId, "I have transferred your settings from your previous room to here.");
    });

    client.on("room.message", (roomId, event) => {
        if (event['sender'] === userId) return;
        if (event['type'] !== "m.room.message") return;
        if (!event['content']) return;
        if (event['content']['msgtype'] !== "m.text") return;

        return Promise.resolve(commands.tryCommand(roomId, event)).catch(err => {
            LogService.error("index", err);
            return client.sendNotice(roomId, "There was an error processing your command");
        });
    });

    client.on("room.event", (roomId, event) => {
        if (event['type'] !== "m.room.bot.options") return;
        if (event['state_key'] !== "_" + userId) return;

        optionsManager.calculateNewRoomOptions(roomId);
    });

    return client.start();
}

finishInit().then(() => LogService.info("index", "Trello bot started!"));
