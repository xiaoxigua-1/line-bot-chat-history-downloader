async function download({ minTime, maxTime }) {
  const zip = new JSZip();
  const url = location.href.split("/");
  const botId = url[3];

  for await (const chatId of getChats(botId)) {
    const historyList = getChatHistory(botId, chatId);
    const data = await formatData(
      historyList,
      minTime ?? 0,
      maxTime ?? Date.now(),
    );

    if (data.length > 0) {
      const files = zip.folder(data[0].id);
      const media = files.folder("media");
      const stickers = files.folder("stickers");
      const flexMessages = files.folder("flex-messages");

      // Download media files
      for (const file of data.filter((i) => i.type === "media")) {
        const fileBlob = await downloadLineFile(botId, file.media);

        media.file(file.fileName, fileBlob);
      }

      // Download sticker
      for (const staicker of data.filter((i) => i.type === "sticker")) {
        const stickerBlob = await downloadSticker(
          staicker.sticker,
          staicker.stickerResourceType,
        );

        stickers.file(
          `${staicker.sticker}-${staicker.stickerResourceType}`,
          stickerBlob,
        );
      }

      // Dwonload flex messages
      for (const flex of data.filter((i) => i.type === "flex")) {
        const flexData = await downloadFlexMessage(
          botId,
          chatId,
          flex.messageId,
          flex.timestamp,
        );

        flexMessages.file(`${flex.messageId}.json`, JSON.stringify(flexData));
      }

      // Save data
      const jsonStr = JSON.stringify(
        data.map((i) => {
          delete i.id;
          delete i.media;
          return i;
        }),
      );

      files.file("data.json", jsonStr);
    }
  }

  zip.generateAsync({ type: "blob" }).then(function (blob) {
    saveFile(blob);
  });
}

async function* getChats(botId) {
  let next = null;

  while (true) {
    const chatsList = await (
      await fetch(
        `https://chat.line.biz/api/v2/bots/${botId}/chats?folderType=ALL&tagIds=&autoTagIds=&limit=25&${
          next ? `next=${next}&` : ""
        }prioritizePinnedChat=true`,
      )
    ).json();
    next = chatsList.next;

    for (const chat of chatsList.list) {
      yield chat.chatId;
    }

    if (!next) break;
  }
}

async function* getChatHistory(botId, chatId) {
  let backward = null;

  while (true) {
    const chatHistory = await (
      await fetch(
        `https://chat.line.biz/api/v3/bots/${botId}/chats/${chatId}/messages${
          backward ? `?backward=${backward}` : ""
        }`,
      )
    ).json();
    backward = chatHistory.backward;

    for (const history of chatHistory.list) {
      yield history;
    }

    if (!backward) break;
  }
}

async function formatData(data, minTime, maxTime) {
  const result = [];

  for await (const message of data) {
    if (message.timestamp >= minTime && message.timestamp <= maxTime) {
      const role =
        message.type === "messageSent"
          ? "bot"
          : message.type === "message"
            ? "user"
            : null;

      if (role) {
        const data = generateMessageData(
          message.source.chatId,
          message.timestamp,
          message.message,
          role,
        );

        data ? result.push(data) : null;
      }
    }
  }

  return result;
}

function generateMessageData(id, timestamp, message, role) {
  switch (message.type) {
    case "text":
      if (message.originalType === "flex")
        return {
          type: "flex",
          id,
          messageId: message.id,
          timestamp,
          role,
        };
      else
        return {
          type: "text",
          id,
          timestamp,
          content: message.text,
          role,
        };
    case "flex":
    case "image":
    case "file":
    case "audio":
    case "video":
      return {
        type: "media",
        id,
        timestamp,
        media: message.contentHash,
        fileName: `${message.contentHash}${fileExtension(message.type)}`,
        role,
      };
    case "sticker":
      return {
        type: "sticker",
        id,
        timestamp,
        sticker: message.stickerId,
        stickerResourceType:
          message.stickerResourceType === "STATIC" ||
          message.stickerResourceType === "POPUP"
            ? "sticker.png"
            : "sticker_animation.png",
        role,
      };
  }
}

function fileExtension(type) {
  switch (type) {
    case "image":
      return ".jpg";
    case "audio":
      return ".m4a";
    case "video":
      return ".mp4";
  }
}

async function downloadLineFile(botId, contentHash) {
  const fileResponse = await fetch(
    `https://chat-content.line.biz/bot/${botId}/${contentHash}`,
    { credentials: "include" },
  );

  return await fileResponse.blob();
}

async function downloadSticker(stickerId, stickerResourceType) {
  const fileResponse = await fetch(
    `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/ANDROID/${stickerResourceType}`,
  );

  return await fileResponse.blob();
}

async function downloadFlexMessage(botId, chatId, messageId, timestamp) {
  const fileResponse = await fetch(
    `https://chat.line.biz/api/v1/bots/${botId}/messages/${chatId}/flexJson?timestamp=${timestamp}&messageId=${messageId}`,
  );

  return await fileResponse.json();
}

function saveFile(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "data.zip";
  a.click();

  window.URL.revokeObjectURL(url);
}

chrome.runtime.onMessage.addListener((message) => {
  (async () => {
    await download(message);
  })();
});
