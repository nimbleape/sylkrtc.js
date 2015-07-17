
# sylkrtc.js

JavaScript library implementing the API for communicating with [SylkServer's](http://sylkserver.com) WebRTC gateway application.


## Building

Grab the source code using Darcs or Git and install the dependencies:

    cd sylkrtc
    npm install


Build the development release (not minified):

    make


Build a minified version:

    make min


## Development

Auto-building the library as changes are made:

    make watch

### Debugging

sylkrtc uses the [debug]() library for easy debugging. By default debugging is disabled. In order to enable sylkrtc debug type the following in the browser JavaScript console:

    sylkrtc.debug.enable('sylkrtc*');

Then refresh the page.


## API

The entrypoint to the library is the `sylkrtc` object. Several objects (`Connection`, `Account` and `Call`) inherit from Node's `EventEmitter` class, you may want to check [its documentation](https://nodejs.org/api/events.html).

### sylkrtc

The main entrypoint to the library. It exposes the main function to connect to SylkServer and some utility functions for general use.

#### sylkrtc.createConnection(options={})

Creates a `sylkrtc` connection towards a SylkServer instance. The only supported option (at the moment) is "server", which should point to the WebSocket endpoint of the WebRTC gateway application. Example: `wss://1.2.3.4:8088/webrtcgateway/ws`.

It returns a `Connection` object.

Example:

    let connection = sylkrtc.createConnection({server: 'wss://1.2.3.4:8088/webrtcgateway/ws'});

#### sylkrtc.isWebRTCSupported()

Returns a boolean value indicated if the current environment supports WebRTC.

#### sylkrtc.attachMediaStream(element, stream)

Helper function to attach the given `stream` (an instance of `RTCMediaStream`) to a given HTML element.

#### sylkrtc.closeMediaStream(stream)

Helper function to close the given `stream`. When a local media stream is closed the camera is stopped in case it was active, for example.

Note: when a `Call` is terminated all streams will be automatically closed.

### Connection

Object representing the interaction with SylkServer. Multiple connections can be created with `sylkrtc.createConnection`, but typically only one is needed. Reconnecting in case the connection is interrupted is taken care of automatically.

Events emitted:
* **ready**: indicates the WebSocket connection has been established and interaction is now possible.

#### Connection.setupAccount(options={})

Configures an `Account` to be used through `sylkrtc`.  2 options are required: *account* (the account ID) and *password*. The account won't be registered, it will just be created.

The *password* won't be stored or transmitted as given, the HA1 hash (as used in [Digest access authentication](https://en.wikipedia.org/wiki/Digest_access_authentication)) is created and used instead.

Example:

    let account = connection.setupAccount({account: saghul@sip2sip.info, password: 1234});

#### Connection.destroyAccount(account)

Destroys the given account. The account will be unbound as part of the process.

#### Connection.close

Close the connection with SylkServer. All accounts will be unbound.

### Account

Object representing a SIP account which will be used for making / receiving calls.

Events emitted:
* **registrationStateChanged**: indicates the SIP registration state has changed. Two arguments are provided: `oldState` and `newState`, the old registration state and the new registration state, respectively.
* **outgoingCall**: emitted when an outgoing call is made. A single argument is provided: the `Call` object.
* **incomingCall**: emitted when an incoming call is received. A single argument is provided: the `Call` object.

#### Account.bind()

*Bind* the account to the current connection. This involves registering the account via SIP.

#### Account.unbind()

*Unbind* the account. This involves unregistering the account via SIP.

#### Account.call(uri, options={})

Start an outgoing call. Supported options:
* pcConfig: configuration options for `RTCPeerConnection`. [Reference](http://w3c.github.io/webrtc-pc/#configuration).
* mediaConstraints: constraints to be used when getting the local user media. [Reference](http://www.w3.org/TR/mediacapture-streams/#mediastreamconstraints).

Example:

    let call = account.call('3333@sip2sip.info', {mediaConstraints: {audio: true, video: false}});

#### Account.id

Getter property returning the account ID.

#### Account.registrationState

getter property returning the current registration state.

### Call

Object representing a audio/video call. Signalling is done using SIP underneath.

Events emitted:
* **localStreamAdded**: emitted when the local stream is added to the call. A single argument is provided: the stream itself.
* **streamAdded**: emitted when a remote stream is added to the call. A single argument is provided: the stream itself.
* **stateChanged**: indicates the call state has changed. Three arguments are provided: `oldState`, `newState` and `data`. `oldState` and `newState` indicate the previous and current state respectively, and `data` is a generic per-state data object. Possible states:
    * terminated: the call has ended (the `data` attribute contains the reason)
    * accepted: the call has been accepted by the remote party (for outgoing calls)
    * incoming: initial state for incoming calls
    * calling: initial state for outgoing calls
    * established: call media has been established

#### Call.answer(options={})

Answer an incoming call. Supported options:
* pcConfig: configuration options for `RTCPeerConnection`. [Reference](http://w3c.github.io/webrtc-pc/#configuration).
* mediaConstraints: constraints to be used when getting the local user media. [Reference](http://www.w3.org/TR/mediacapture-streams/#mediastreamconstraints).

#### Call.terminate()

End the call.

#### Call.getLocalStreams()

Returns an array of *local* `RTCMediaStream` objects.

#### Call.getRemoteStreams()

Returns an array of *remote* `RTCMediaStream` objects.

#### Call.account

Getter property which returns the `Account` object associated with this call.

#### Call.id

Getter property which returns the ID for this call. Note: this is not related to the SIP Call-ID header.

#### Call.direction

Getter property which returns the call direction: "incoming" or "outgoing". Note: this is not related to the SDP "a=" direction attribute.

## License

MIT. See the `LICENSE` file in this directory.