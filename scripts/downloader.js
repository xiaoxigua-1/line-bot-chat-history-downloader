async function download({ minTime, maxTime }) {
  const chatList = document.querySelector(
    "#content-primary > div > div.chatlist.d-flex.flex-column.justify-content-center.flex-fill.h-min-0 > div.flex-fill.overflow-y-auto > div",
  );
  const chats = [];
  const zip = new JSZip();
  const images = zip.folder("images");

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

    if (data.length > 0) chats.push(data);

    for (const image of data.filter((data) => data.media)) {
      const imageResponse = await fetch(
        `https://chat-content.line.biz/bot/${botId}/${image.media}`,
      );
      const imageBlob = await imageResponse.blob();

      images.file(`${image.media}.jpg`, imageBlob);
    }
  }

  zip.file("data.json", JSON.stringify(chats));
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
          message.timestamp,
          message.message,
          role,
        );

        result.push(data);
      }
    }
  }

  return result;
}

function generateMessageData(timestamp, message, role) {
  if (message.type === "text") {
    return {
      timestamp,
      content: message.text,
      role,
    };
  } else if (message.type === "image") {
    return {
      timestamp,
      media: message.contentHash,
      role,
    };
  }
}

function saveFile(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.zip";
  a.click();
  window.URL.revokeObjectURL(url);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await download(message);
  })();
});
