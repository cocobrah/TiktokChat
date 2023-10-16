const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8477 });

// Keep track of streamer to WebcastPushConnection mapping
const tiktokConnections = {};

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message);

        if (parsedMessage.type === 'connectStreamer') {
            const streamerUsername = parsedMessage.username;

            if (!tiktokConnections[streamerUsername]) {
                let tiktokLiveConnection = new WebcastPushConnection(streamerUsername);
                
                tiktokLiveConnection.connect().then(state => {
                    console.info(`Connected to ${streamerUsername}`);
                    const connectedStatusData = {
                        type: 'connectedStatus',
                        status: 'connected'
                      };

                    broadcastToStreamer(streamerUsername, connectedStatusData);
                }).catch(err => {
                    const connectedStatusData = {
                        type: 'connectedStatus',
                        status: 'failed'
                    }
                    broadcastToStreamer(streamerUsername, connectedStatusData);
                    console.error('Failed to connect', err);
                });

                // Define the events handled
                tiktokLiveConnection.on('chat', data => {
                    const username = data.nickname;
                    const message = data.comment;
                    onNewChatMessage(username, message, streamerUsername);
                })

                // Here we receive gifts sent to the streamer
                tiktokLiveConnection.on('gift', data => {
                    const username = data.nickname;
                    const giftName = data.giftName;
                    const repeatCount = data.repeatCount;
                    const value = data.diamondCount;
                    const type = 'gift';
                    
                    if (data.giftType === 1 && !data.repeatEnd) {
                        // Streak in progress => show only temporary
                        broadcastToStreamer(streamerUsername, {
                            type,
                            username,
                            giftName,
                            repeatCount,
                            value,
                            message: 'in-progress'
                        });
                    } else {
                        // Streak ended or non-streakable gift => process the gift with final repeat_count
                        broadcastToStreamer(streamerUsername, {
                            type,
                            username,
                            giftName,
                            repeatCount,
                            value,
                            message: 'ended'
                        });
                    }
                });

                tiktokLiveConnection.on('roomUser', data => {
                    const viewerCount = data.viewerCount;
                    onViewerCount(viewerCount, streamerUsername);
                })

                tiktokLiveConnection.on('like', data => {
                    const likeCount = data.totalLikeCount;
                    onLike(likeCount, streamerUsername);
                })

                tiktokLiveConnection.on('subscribe', (data) => {
                    const message = ' subscribed!';
                    const username = data.nickname;
                    onSocialFunction(username, message, streamerUsername);
                })

                tiktokLiveConnection.on('follow', (data) => {
                    const username = data.nickname;
                    const message = ' followed!';
                    onSocialFunction(username, message, streamerUsername);
                })

                tiktokLiveConnection.on('share', (data) => {
                    const username = data.nickname;
                    const message = ' shared the stream!';
                    onSocialFunction(username, message, streamerUsername);
                })

                tiktokConnections[streamerUsername] = tiktokLiveConnection;
            }
            // Associate the WebSocket with a particular streamer
            ws.streamerUsername = streamerUsername;
        }
    });

    ws.on('close', () => {
        // Get the associated streamer's username for this WebSocket
        const streamerUsername = ws.streamerUsername;
        if (streamerUsername && tiktokConnections[streamerUsername]) {
          // Close the TikTok room connection
          tiktokConnections[streamerUsername].disconnect();
          console.log(`Disconnected from ${streamerUsername}`);
          delete tiktokConnections[streamerUsername];
        }
      });
});

function broadcastToStreamer(streamerUsername, data) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.streamerUsername === streamerUsername) {
            client.send(JSON.stringify(data));
        }
    });
}

function onNewChatMessage(username, message, streamerUsername) {
    // Create a JSON object to hold the chat message and username
    const chatData = {
      type: 'chat',
      username: username,
      message: message
    };
  
    broadcastToStreamer(streamerUsername, chatData); 
}

function onViewerCount(viewerCount, streamerUsername) {
    // Create a JSON object to hold current count
    const viewerCountData = {
      type: 'viewerCount',
      count: viewerCount
    };
  
    broadcastToStreamer(streamerUsername, viewerCountData);
}

function onLike(likeCount, streamerUsername) {
    // Create a JSON object to hold current count
    const likeCountData = {
      type: 'likeCount',
      count: likeCount
    };

    broadcastToStreamer(streamerUsername, likeCountData);
}

function onSocialFunction(username, message, streamerUsername) {
    // Create a JSON object to hold the chat message and username
    const socialData = {
      type: 'social',
      username: username,
      message: message
    };

    broadcastToStreamer(streamerUsername, socialData);
}

// // Username of someone who is currently live
// let tiktokUsername = "caseyvanarsdale";

// // Create a new wrapper object and pass the username
// let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername, [enableExtendedGiftInfo=true]);

// // Connect to the chat (await can be used as well)
// tiktokLiveConnection.connect().then(state => {
//     console.info(`Connected to roomId ${state.roomId}`);
// }).catch(err => {
//     console.error('Failed to connect', err);
// })

// // Define the events that you want to handle
// // In this case we listen to chat messages (comments)
// tiktokLiveConnection.on('chat', data => {
//     console.log(`${data.nickname} writes: ${data.comment}`);
//     const username = data.nickname;
//     const message = data.comment;
//     onNewChatMessage(username, message);
// })

// // And here we receive gifts sent to the streamer
// tiktokLiveConnection.on('gift', data => {
//     if (data.giftType === 1 && !data.repeatEnd) {

//     } else {
//         // Streak ended or non-streakable gift => process the gift with final repeat_count
//         const diamondValue = data.diamondCount * data.repeatCount;
//         console.log(`${data.nickname} has sent gift ${data.giftName} x${data.repeatCount} worth ${diamondValue} diamond(s).`);
//     }
//     const username = data.nickname;
//     const giftId = data.giftId;
//     const value = data.diamondCount;
//     onGiftDonation(username, giftId, value);
// })

// tiktokLiveConnection.on('roomUser', data => {
//     const viewerCount = data.viewerCount;
//     onViewerCount(viewerCount);
// })

// tiktokLiveConnection.on('like', data => {
//     const likeCount = data.totalLikeCount;
//     onLike(likeCount);
// })

// tiktokLiveConnection.on('subscribe', (data) => {
//     const message = ' subscribed!';
//     const username = data.nickname;
//     onSocialFunction(username, message);
// })

// tiktokLiveConnection.on('follow', (data) => {
//     const username = data.nickname;
//     const message = ' followed!';
//     onSocialFunction(username, message);
// })

// tiktokLiveConnection.on('share', (data) => {
//     const username = data.nickname;
//     const message = ' shared the stream!';
//     onSocialFunction(username, message);
// })