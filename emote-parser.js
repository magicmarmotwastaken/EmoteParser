// Written by MagicMarmot (from Kick/Twitch)
class EmoteParser {
  constructor (userId, channelName) { // Initialize with Twitch userID and Twitch/Kick channel name
    this._userUrls = {
      'sevenTV': '7tv.io/v3/users/twitch',
      'FFZ': 'api.frankerfacez.com/v1/room',
      'BTTV': 'api.betterttv.net/3/cached/users/twitch'
    }
    this._globalUrls = {
      'sevenTV': '7tv.io/v3/emote-sets/global',
      'FFZ': 'api.frankerfacez.com/v1/set/global',
      'BTTV': 'api.betterttv.net/3/cached/emotes/global'
    }

    this.size = 2
    this.userId = userId
    this.channel = channelName

    this.loadEmotes('FFZ', this.channel)
    this.loadEmotes('BTTV', this.userId)
    this.loadEmotes('sevenTV', this.userId)
  }

  _reduceEmoteSet (emotes, emoteKey) { // Produce simplified key/value pair for emote sets
    if (!emotes) {
      console.error('error: emotes missing', emoteKey)
      return {}
    }
    return emotes.reduce((acc, emote) => {
      acc[emote.name ?? emote.code] = emote.id
      return acc
    }, this[emoteKey] ?? {})
  }

  _createEmoteRegex (emotes) { // Matches any emote 'common name' (e.g. NODDERS) from the emote set
    return new RegExp(`\\b(${Object.keys(emotes).join("|")})\\b`, "g")
  }

  setSize (size) { this.size = size } // Change emote image size (1, 2, or 3)

  fetchEmotes (provider, identifier) {
    let self = this,
        url = identifier ? `${this._userUrls[provider]}/${identifier}` : this._globalUrls[provider]

    fetch(`https://${url}`)
      .then(response => response.json())
      .then(body => {
        let emoteKey = `${provider}Emotes`,
            emoteSet = body.emotes ? body.emotes :
                       body.emote_set ? body.emote_set.emotes :
                       body.room ? body.sets[body.room.set].emoticons : //FFZ User
                       body.default_sets ? body.default_sets.reduce((acc, key) => [...acc, ...body.sets[key].emoticons], []) : //FFZ Global
                       body.sharedEmotes || body.channelEmotes ? [...(body.sharedEmotes ?? []), ...(body.channelEmotes ?? [])] : //BTTV User
                       body.length && provider == 'BTTV' ? body : null //BTTV Global
      
        self[emoteKey] = self._reduceEmoteSet(emoteSet, emoteKey)
        self[`${provider}Regex`] = self._createEmoteRegex(self[emoteKey])
      }).catch(e => { console.error(e) })
  }

  loadEmotes (provider, identifier) {
    this.fetchEmotes(provider) // Load global emotes for provider
    this.fetchEmotes(provider, identifier) // Load user emotes
  }

  parseTTV (message, tags, purge) {
    return message.replace(
      /\S+/g, // Match any non-whitespace character one or more times
      (match) => {
        for (const imageId in tags.emotes) {
          for (const rangeStr of tags.emotes[imageId]) {
            const [start, end] = rangeStr.split("-").map(Number),
                  substr = message.substring(start, end + 1)
            if (match === substr) 
              return purge ? '' : `<img class="twitch-emote emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${imageId}/default/dark/${this.size}.0">`
          }
        }
        return match // If no emote match, return the original match
      }
    )
  }

  removeEmotes (message, tags) {
    return this.parseTTV(message, tags, true).replace(this.BTTVRegex, '').replace(this.FFZRegex, '').replace(this.sevenTVRegex, '').trim()
  }

  parseEmotes (provider, message) {
    return message.replace(this[`${provider}Regex`], (match) => {
      const imageId = this[`${provider}Emotes`][match];
      const src = (provider == 'sevenTV') ? `7tv.app/emote/${imageId}/${this.size}x.webp` :
                  (provider == 'FFZ') ? `frankerfacez.com/emote/${imageId}/${this.size}` :
                  (provider == 'BTTV') ? `betterttv.net/emote/${imageId}/${this.size}x` : null;

      return src ? `<img class="${provider}-emote emote" src="https://cdn.${src}">` : ``
    })
  }

  parseMessage (message, tags) { // Primary method: Parses everything at once
    return this.parseEmotes('BTTV', this.parseEmotes('FFZ', this.parseEmotes('sevenTV', this.parseTTV(message, tags))))
  }
}

module.exports = EmoteParser;
