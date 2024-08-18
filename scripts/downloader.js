async function download({ minTime, maxTime }) {
  const chatList = document.querySelector(
    "#content-primary > div > div.chatlist.d-flex.flex-column.justify-content-center.flex-fill.h-min-0 > div.flex-fill.overflow-y-auto > div",
  );
  const zip = new JSZip();

  for (const chat of chatList.querySelectorAll(".list-group-item-chat")) {
    chat.querySelector("a:nth-child(2)").click();

    const url = location.href.split("/");
    const botId = url[3];
    const chatId = url[5];

    const historyList = await fetch(
      `https://chat.line.biz/api/v2/bots/${botId}/messages/${chatId}`,
    );

    const data = formatData(
      await historyList.json(),
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

function formatData(data, minTime, maxTime) {
  const result = [];

  for (const message of data["list"]) {
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
      return {
        type: "media",
        id,
        timestamp,
        media: message.contentHash,
        fileName:
          message.type === "image"
            ? message.contentHash + ".jpg"
            : message.type === "audio"
              ? message.contentHash + ".m4a"
              : message.fileName,
        role,
      };
    case "sticker":
      return {
        type: "sticker",
        id,
        timestamp,
        sticker: message.stickerId,
        stickerResourceType:
          message.stickerResourceType === "STATIC"
            ? "sticker.png"
            : "sticker_animation.png",
        role,
      };
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
