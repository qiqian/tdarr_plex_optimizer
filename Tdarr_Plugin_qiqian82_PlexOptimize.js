/* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
function details() {
  return {
    id: 'Tdarr_Plugin_qiqian82_PlexOptimize',
    Stage: 'Pre-processing',
    Name: 'My Plex Optimize',
    Type: 'Video',
    Operation: 'Transcode',
    Description: `Be smart`,
    Version: '3.0',
    Link: 'https://github.com/HaveAGitGat/Tdarr_Plugins/blob/master/Community/Tdarr_Plugin_MC93_Migz1FFMPEG.js',
    Tags: 'pre-processing,ffmpeg,video only,nvenc h265,configurable',
    Inputs: [
    {
      name: 'audio_remove_except',
      tooltip: `Specify language to remove unless they are in the list. 
               \\Leave empty to disable.
               \\nExample:\\n
               en,eng,jp,jap,jpn`,
    },
    {
      name: 'audio_remove',
      tooltip: `Specify language tag/s here for the audio tracks you'd like to remove. 
               \\Leave empty to disable.
               \\nExample:\\n
               en,eng,jp,jap,jpn`,
    },
    {
      name: 'audio_title_remove',
      tooltip: `Specify language title here for the audio tracks you'd like to remove. 
               \\Leave empty to disable.
               \\nExample:\\n
               粤,cantonese`,
    },
    {
      name: 'tmdb_api_key',
      tooltip: `The Movie Database API Key`,
    }
    ],
  };
}

function findTrack(file, stream)
{
  for (let i = 0; i < file.mediaInfo.track.length; i++) {
    let track = file.mediaInfo.track[i];
    if (track.StreamOrder === undefined && track.ID === undefined)
      continue;
    if (stream.index !== undefined && Number(track.StreamOrder) === stream.index)
      return track;
    if (stream.id !== undefined && Number(track.ID) === Number(stream.id))
      return track;
    if (Number(track.ID) === Number(stream.index) + 1)
      return track;
  }
  return undefined;
}

function getTrackBitrate(stream, track)
{
  if (stream.bit_rate !== undefined) 
    return parseInt(stream.bit_rate);
  
  if (track === undefined)
    return -1;

  if (track.BitRate !== undefined)
    return parseInt(track.BitRate);

  if (track.BitRate_Nominal !== undefined)
    return parseInt(track.BitRate_Nominal); 
    
  if (track.StreamSize === undefined)
    return -1;

  let duration = track.Duration;
  //if (duration === undefined)
  //  duration = file.meta.Duration;
  if (duration === undefined)
    return -1;

  return parseInt(Number.parseFloat(track.StreamSize) / Number.parseFloat(duration));
}

function findTitle(stream, track)
{
  let title = undefined;
  if (track !== undefined)
    title = track.Title;
  if (title === undefined && stream.tags !== undefined)
    title = stream.tags.title;
  // if (title === undefined)
  //   title = "noname";
  return title;
}

function getLang(stream, track)
{
  let lang = undefined;
  if (track !== undefined)
    lang = track.Language;
  if (lang === undefined && stream.tags !== undefined)
    lang = stream.tags.language;
  if (lang === undefined)
    lang = "und";
  lang = normalizeLang(lang);
  return lang;
}

function fixLang(lang, stream, track)
{
  //if (lang !== 'und')
  //  return lang;
  let title = findTitle(stream, track);
  if (title !== undefined) {
    title = title.toLowerCase();
    for (key in LangMap) {
      let langInfo = LangMap[key];
      if (includesListAny(title, langInfo.title))
        return langInfo.alias[0];
    }    
  }
  return lang;
}

function fillLangAlias_set(langList, aliasSet) 
{
  let fill = false;
  for (let i = 0; i < aliasSet.length; ++i) {
    if (langList.indexOf(aliasSet[i]) >= 0) {
      fill = true;
      break;
    }
  }
  if (!fill)
    return;
  for (let i = 0; i < aliasSet.length; ++i) {
    if (langList.indexOf(aliasSet[i]) < 0)
      langList.push(aliasSet[i]);
  }
}

const LangMap = {
  'zh' : {
    'alias' : ['zh', 'chi', 'chn', 'cn', 'zho'],
    'title' : ['中文', '國', '国语', '汉语', '国配', '台配', '港', '辽艺', '普通话', 'Chinese', 'Mandarin'],
    'ffmpeg' : 'chi'
  },
  'en' : {
    'alias' : ['en', 'eng'],
    'title' : ['英语', '英文', 'English'],
    'ffmpeg' : 'eng'
  },
  'ja' : {
    'alias' : ['ja', 'jpn', 'jp', 'jap'],
    'title' : ['日语', '日文', 'Japanese'],
    'ffmpeg' : 'jpn'
  },
  'ko' : {
    'alias' : ['ko', 'kor', 'kr'],
    'title' : ['韩', 'Korea'],
    'ffmpeg' : 'kor'
  },
  'fr' : {
    'alias' : ['fr', 'fre', 'fra', 'fro', 'frm'],
    'title' : ['法语', 'French'],
    'ffmpeg' : 'fre'
  },
  'de' : {
    'alias' : ['de', 'gem', 'ger', 'deu', 'gmh', 'goh'],
    'title' : ['德语', 'German'],
    'ffmpeg' : 'ger'
  },
  'es' : {
    'alias' : ['es', 'spa'],
    'title' : ['西班牙', 'Spanish'],
    'ffmpeg' : 'spa'
  },
  'th' : {
    'alias' : ['th', 'tha'],
    'title' : ['泰', 'Thai'],
    'ffmpeg' : 'tha'
  },
  'hi' : {
    'alias' : ['hi', 'hin'],
    'title' : ['印度', 'India'],
    'ffmpeg' : 'hin'
  }
};

function fillLangAlias(langList)
{  
  for (lang in LangMap) {
    let langInfo = LangMap[lang];
    fillLangAlias_set(langList, langInfo.alias);
  }
}

function normalizeLang(lang)
{  
  for (key in LangMap) {
    let langInfo = LangMap[key];
    if (langInfo.alias.indexOf(lang) >= 0)
      return langInfo.alias[0];
  }
  return lang;
}
function cacheAudio(file, stream, audioMap)
{
  let track = findTrack(file, stream);
  let lang = getLang(stream, track);  
  lang = fixLang(lang, stream, track);
  // init map
  if (audioMap[lang] === undefined)
    audioMap[lang] = [];
  // if (audioMap[lang][stream.codec_name] == undefined)
    // audioMap[lang][stream.codec_name] = [];
  // record
  audioMap[lang].push(stream);
}
function infoAudio(file, stream, action)
{
  let track = findTrack(file, stream);
  let bitrate = getTrackBitrate(stream, track);
  if (bitrate < 0)
    bitrate = "?";
  let title = findTitle(stream, track);
  let lang = getLang(stream, track);
  return `Audio[${stream.index}], ${title}, ${lang}, ${stream.codec_name} `
  + `${bitrate} -> ${action} \n`; 
}

function matchListAny(name, listAny)
{
  if (name === undefined || name === '')
    return false;
  for (let i = 0; i < listAny.length; i++) {
    let e = listAny[i].trim().toLowerCase();
    if (e === '')
      continue;
    if (name === e)
      return true;
  }
  return false; 
}
function includesListAny(name, listAny)
{
  if (name === undefined || name === '')
    return false;
  for (let i = 0; i < listAny.length; i++) {
    let e = listAny[i].trim().toLowerCase();
    if (e === '')
      continue;
    if (name.includes(e))
      return true;
  }
  return false;
}
function cleanupArray(listAny) 
{
  for (let i = listAny.length - 1; i >= 0; i--) {
    let e = listAny[i].trim().toLowerCase();
    if (e === '')
      listAny.splice(i, 1);
  }
}

function is10bit(stream, track) 
{
  return stream.profile === 'High 10' || stream.profile === 'Main 10' ||
          stream.bits_per_raw_sample === '10' || stream.pix_fmt == 'yuv420p10le' ||
          (track !== undefined && (track.Format_Profile === 'High 10' || track.Format_Profile === 'Main 10' || track.BitDepth === '10'));
}

function infoVideo(file, stream, action)
{
  let track = findTrack(file, stream);
  let bitrate = getTrackBitrate(stream, track);
  if (bitrate <= 0)
    bitrate = "?";
  else 
    bitrate = parseInt(bitrate / 1000);
  let title = findTitle(stream, track);
  let bitDepth = is10bit(stream, track) ? "10-bit" : "8-bit";
  return `Video[${stream.index}], ${title}, ${stream.codec_name} `
  + `${stream.width}x${stream.height} ${bitrate}k ${bitDepth} -> ${action} \n`;
}

function guessSubLang(sub)
{
  let subLangConfig = [ 
    { 'lang' : 'zh', 'title' : '繁体中文', 'Sep' : '', 'mark' : 
      ['為','類','問','從','這','個','時','間','裏','卻','們','樣','點','終','讓','對'] }, 

    { 'lang' : 'zh', 'title' : '简体中文', 'Sep' : '', 'mark' : 
      ['为','类','问','从','这','个','时','间','里','却','们','样','点','终','让','对'] }, 
    
    { 'lang' : 'en', 'title' : '英语', 'Sep' : ' ', 'mark' :  
      ['the','and','that','this','here','have','there','he','she','for','not',
       'with','you','their','what','take','one','all','my','will','her','say',
       'they','from','but'] }
    ];
  let data = require('fs').readFileSync(sub, 'utf8').toLowerCase();
  data = data.substring(data.indexOf(' --> 00:1')); // skip 10 min
  for (let i = 0; i < subLangConfig.length; i++) {
      let config = subLangConfig[i];
      let count = 0;
      for (let k = 0; k < config.mark.length; k++) {
        if (data.includes(config.Sep + config.mark[k] + config.Sep))
          ++count;
        if (count >= 3)
          return config;
      }
  }
  return undefined;
}

function extractNormalizedValue(v, norm)
{
  let parts = v.split('/');
  let scale = norm / parseInt(parts[1]);
  return parseInt(parts[0]) * scale;
}

function findOriginalLang(nfoFile, apiKey, response) 
{
  const nfo = require('fs').readFileSync(nfoFile, 'utf8');

  const seasonRegex = /<season>([0-9]+)<\/season>/;
  const episodeRegex = /<episode>([0-9]+)<\/episode>/;
  const imdbidRegex = /<imdbid>tt([0-9]+)<\/imdbid>/;
  const tvdbidRegex = /<tvdbid>([0-9]+)<\/tvdbid>/;
  const tmdbidRegex = /<tmdbid>([0-9]+)<\/tmdbid>/;  
  

  let imdbid = nfo.match(imdbidRegex);
  if (imdbid != null)
    imdbid = imdbid[1];

  let tmdbid = nfo.match(tmdbidRegex);  
  if (tmdbid != null)
    tmdbid = tmdbid[1];

  let tvdbid = nfo.match(tvdbidRegex);
  if (tvdbid != null)
    tvdbid = tvdbid[1];

  // response.infoLog += `imdb:${imdbid}, tmdb:${tmdbid}, tvdb:${tvdbid}`;

  if (nfo.match(seasonRegex) == null || nfo.match(episodeRegex) == null) {
    // response.infoLog += ` movie\n`;
    // movie
    let movieInfo = '';
    if (tmdbid != null) {
      const req = `curl --silent -L "https://api.themoviedb.org/3/movie/${tmdbid}/3?api_key=${apiKey}&language=en-US"`;
      movieInfo = require("child_process").execSync(req);
      if (movieInfo != null) {
        movieInfo = JSON.parse(movieInfo);
        if (movieInfo.success !== undefined && !movieInfo.success)
          ; // faile
        else
          return movieInfo.original_language;
      }
    }
    if (imdbid != null) {
      const req = `curl --silent -L "https://api.themoviedb.org/3/find/tt${imdbid}?api_key=${apiKey}&language=en-US&external_source=imdb_id"`;
      movieInfo = require("child_process").execSync(req);
      if (movieInfo != null) {
        movieInfo = JSON.parse(movieInfo).movie_results;
        if (movieInfo.length == 0)
          ; // fail
        else 
          return movieInfo[0].original_language;
      }
    }    
  }
  else {
    response.infoLog += ` tv\n`;
    // find show id
    let show_id = null;
    if (tmdbid != null) {
      const req = `curl --silent -L "https://api.themoviedb.org/3/find/tt${imdbid}?api_key=${apiKey}&language=en-US&external_source=imdb_id"`;
      let episodeInfo = require("child_process").execSync(req);
      // response.infoLog += episodeInfo+"\n";
      if (episodeInfo != null) {
        episodeInfo = JSON.parse(episodeInfo).tv_episode_results;
        if (episodeInfo.length == 0)
          ; // fail
        else 
          show_id = episodeInfo[0].show_id;
      }      
    }
    if (show_id == null && tvdbid != null) {
      const req = `curl --silent -L "https://api.themoviedb.org/3/find/${tvdbid}?api_key=${apiKey}&language=en-US&external_source=tvdb_id"`;
      let episodeInfo = require("child_process").execSync(req);
      // response.infoLog += episodeInfo+"\n";
      if (episodeInfo != null) {
        episodeInfo = JSON.parse(episodeInfo).tv_episode_results;
        if (episodeInfo.length == 0)
          ; // fail
        else 
          show_id = episodeInfo[0].show_id;
      }
    }
    if (show_id != null) {
      // find show info
      const req = `curl --silent -L "https://api.themoviedb.org/3/tv/${show_id}?api_key=${apiKey}&language=en-US"`;
      let showInfo = require("child_process").execSync(req);
      // response.infoLog += showInfo+"\n";
      if (showInfo != null) {
        showInfo = JSON.parse(showInfo);
        if (showInfo.success !== undefined && !showInfo.success)
          ; // fail
        else 
          return showInfo.original_language;
      }
    }
  }
  return "und";
}

function plugin(file, librarySettings, inputs) {
  const response = {
    processFile: false,
    preset: '',
    handBrakeMode: false,
    FFmpegMode: true,
    reQueueAfter: false,
    infoLog: '',
  };
  
  var os = require("os")
  const nfo = file.file.split('.').slice(0, -1).join('.') + ".nfo";
  response.infoLog += `${os.hostname()} ram : ${os.totalmem()}\n`;
  response.infoLog += `file : ${JSON.stringify(file.file)}\n`;
  response.infoLog += `nfo : ${nfo}\n`;
  let originalLang = findOriginalLang(nfo, inputs.tmdb_api_key, response);
  response.infoLog += `orignal language : ${originalLang}\n`;
  response.infoLog += `cache: ${JSON.stringify(librarySettings.cache)}\n`;

  // Check if file is a video. If it isn't then exit plugin.
  if (file.fileMedium !== 'video') {
    response.processFile = false;
    response.infoLog += 'File is not a video. \n';
    return response;
  }

  response.container = 'mkv';

  let audio_remove_except = [];
  let audio_remove = [];
  let audio_title_remove = [];
  if (inputs !== undefined && inputs.audio_remove_except !== undefined) {
    audio_remove_except = inputs.audio_remove_except.split(',');
    fillLangAlias(audio_remove_except);
    cleanupArray(audio_remove_except);
  }
  if (inputs !== undefined && inputs.audio_remove !== undefined) {
    audio_remove = inputs.audio_remove.split(',');
    fillLangAlias(audio_remove);
    cleanupArray(audio_remove);
  }
  if (inputs !== undefined && inputs.audio_title_remove !== undefined) {
    audio_title_remove = inputs.audio_title_remove.split(',');
    cleanupArray(audio_title_remove);
  }
  response.infoLog += `Audio, `
  + `keep (${audio_remove_except.length}) : ${audio_remove_except}, `
  + `remove (${audio_remove.length + audio_title_remove.length}) : ${audio_remove} ${audio_title_remove}\n`;

  // Set up required variables.
  let extraArguments = '';
  let maxFrameBitrate = 0;
  let outputStreamIndex = 0;

  let needModifyVideo = false;
  let needModifyAudio = false;
  let needModifySubtitle = false;
  let needDiscardExtra = false;
  
  let audioMap = {};
  let audioMapDel = {};

  let subStreams = { zh:[], en:[], und:[] };
  let defaultSub = undefined;

  let hasValidVideoTrack = false;
  let hasValidAudioTrack = false;
  let bestVideoWidth = 0;
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    let stream = file.ffProbeData.streams[i];
    let track = findTrack(file, stream);
    if (track === undefined)
      continue;
    // Check if stream is a video.
    if (stream.codec_type.toLowerCase() === 'video') {
      hasValidVideoTrack = true;
      if (stream.width > bestVideoWidth)
        bestVideoWidth = stream.width;
    }
    if (stream.codec_type.toLowerCase() === 'audio')
      hasValidAudioTrack = true;
  }

  // Go through each stream in the file.
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    let stream = file.ffProbeData.streams[i];
    let track = findTrack(file, stream);
    let title = findTitle(stream, track);
    // Check if stream is a video.
    if (stream.codec_type.toLowerCase() === 'video') {
      // Check if codec of stream is mjpeg/png, if so then remove this "video" stream.
      // mjpeg/png are usually embedded pictures that can cause havoc with plugins.
      if (stream.codec_name === 'mjpeg' || stream.codec_name === 'png' || (hasValidVideoTrack && track === undefined) ) {
        response.infoLog += infoVideo(file, stream, `[${outputStreamIndex}] removed`);
        continue;
      }
      if (stream.width < bestVideoWidth) {
        response.infoLog += infoVideo(file, stream, `[${outputStreamIndex}] removed`);
        continue; 
      }

      // bitrate calculator
      let targetBitrate = 1500; // 480p
      if (stream.width > 640)
        targetBitrate = 3200; // sd
      if (stream.width > 1280)
        targetBitrate = 7200; // 1k
      if (stream.width > 1920)
        targetBitrate = 18000; // 2k
      if (stream.width > 2560)
        targetBitrate = 28780; // 4k
      if (stream.width > 3840)
        targetBitrate = 115139; // 8k

      // Check if video stream is HDR or 10bit
      let bitDepth = "8-bit";
      if (is10bit(stream, track)) {
        bitDepth = "10-bit";
        targetBitrate = parseInt(targetBitrate * 1.25);
      }

      // re-encode h265 if necessary
      let targetCRF = 24;
      if (stream.codec_name === 'hevc' && track !== undefined) {
        let keepHevc = false;
        // skip if encoded in hevc crf mode
        if (track !== undefined && track.Encoded_Library_Settings !== undefined) {
          if (track.Encoded_Library_Settings.includes('/ rc=crf / crf='))
            keepHevc = true;
        }
        // keep stream if at reasonable bitrate 
        let bitrate = getTrackBitrate(stream, track);
        if (bitrate > 0 && bitrate <= targetBitrate * 1000) {
          keepHevc = true;
        }
        // keep hdr10+ && dolby vision
        if (track.HDR_Format_Compatibility !== undefined && track.HDR_Format_Compatibility !== "HDR10") {
          keepHevc = true;
        }

        if (keepHevc) {
          extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
          response.infoLog += infoVideo(file, stream, `[${outputStreamIndex}] retain`);
          outputStreamIndex++;
          continue;
        }
        // re-encode to vbr
        targetCRF = 19;
      }

      // hdr info
      let hdrconfig = ``;
      if (track.HDR_Format_Compatibility === "HDR10") {
        let ff_cmd = ` ffprobe -hide_banner -loglevel error -select_streams ${stream.index} -print_format json -show_frames -read_intervals "%+#1" -show_entries "frame=color_space,color_primaries,color_transfer,side_data_list,pix_fmt" -i "${file.file}" `;
        const hdrinfo = JSON.parse(require("child_process").execSync(ff_cmd)).frames[0];
        const hdrdisplay = hdrinfo.side_data_list[0];
        const hdrcll = hdrinfo.side_data_list[1];
        const red_x = extractNormalizedValue(hdrdisplay.red_x, 50000);
        const red_y = extractNormalizedValue(hdrdisplay.red_y, 50000);
        const green_x = extractNormalizedValue(hdrdisplay.green_x, 50000);
        const green_y = extractNormalizedValue(hdrdisplay.green_y, 50000);
        const blue_x = extractNormalizedValue(hdrdisplay.blue_x, 50000);
        const blue_y = extractNormalizedValue(hdrdisplay.blue_y, 50000);
        const white_point_x = extractNormalizedValue(hdrdisplay.white_point_x, 50000);
        const white_point_y = extractNormalizedValue(hdrdisplay.white_point_y, 50000);
        const min_luminance = extractNormalizedValue(hdrdisplay.min_luminance, 10000);
        const max_luminance = extractNormalizedValue(hdrdisplay.max_luminance, 10000);
        const max_content = hdrcll.max_content;
        const max_average = hdrcll.max_average; 
        hdrconfig = `hdr-opt=1:repeat-headers=1:colorprim=${hdrinfo.color_primaries}:transfer=${hdrinfo.color_transfer}:colormatrix=${hdrinfo.color_space}:master-display=G(${green_x},${green_y})B(${blue_x},${blue_y})R(${red_x},${red_y})WP(${white_point_x},${white_point_y})L(${max_luminance},${min_luminance}):max-cll=${max_content},${max_average}:`;
      }

      // re-encode
      needModifyVideo = true;
      let maxVideoBitrate = parseInt(targetBitrate * 1.5);
      let vbvBuff = parseInt(targetBitrate * 2);
      maxFrameBitrate += vbvBuff;

      extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} libx265 -crf ${targetCRF} -preset slow -x265-params ${hdrconfig}vbv-maxrate=${maxVideoBitrate}:vbv-bufsize=${vbvBuff} `;
      if (bitDepth === "10-bit" || track.HDR_Format_Compatibility === "HDR10") {
        extraArguments += " -pix_fmt yuv420p10le";
      }
      response.infoLog += infoVideo(file, stream, `[${outputStreamIndex}] x265 ${bitDepth}`);
      outputStreamIndex++;
    }
  }
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    let stream = file.ffProbeData.streams[i];
    let track = findTrack(file, stream);
    let title = findTitle(stream, track);
    if (stream.codec_type.toLowerCase() === 'audio') {
      let lang = getLang(stream, track).toLowerCase();
      let removeAudio = false;

      if (hasValidAudioTrack && track === undefined) {
        removeAudio = true;
      }
      else {
      if (lang !== 'und') {
        if (audio_remove_except.length > 0) {
          if (!matchListAny(fixLang(lang, stream, track), audio_remove_except)) {
            // response.infoLog += `Unkeep codec : ${audio_remove_except} : ${audio_remove_except.length} : ${lang}\n`;
            removeAudio = true;
          }
        }
        if (audio_remove.length > 0) {
          if (matchListAny(fixLang(lang, stream, track), audio_remove)) {
            // response.infoLog += `Remove codec : ${audio_remove} : ${audio_remove.length} : ${lang}\n`;
            removeAudio = true;
          }
        }
      }
      if (title !== undefined) {
        if (audio_title_remove.length > 0) {
          if (includesListAny(title.toLowerCase(), audio_title_remove)) {
            // response.infoLog += `Remove title : ${audio_title_remove} : ${audio_title_remove.length} : ${lang}\n`;
            removeAudio = true;
          }
        }
      }
      }
      
      if (removeAudio) {
        // skip
        // response.infoLog += infoAudio(file, stream, 'removed');

        cacheAudio(file, stream, audioMapDel);
      }
      else {
        // extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
        // response.infoLog += infoAudio(file, stream, `[${outputStreamIndex}] copy`);
        // outputStreamIndex++;

        cacheAudio(file, stream, audioMap);

        if (lang !== fixLang(lang, stream, track))
          needModifyAudio = true;
      }
    }
  }
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    let stream = file.ffProbeData.streams[i];
    let track = findTrack(file, stream);
    let title = findTitle(stream, track);
    if (stream.codec_type.toLowerCase() === 'subtitle') {
      let lang = getLang(stream, track).toLowerCase();
      let guessLangInfo = undefined;
      // fix unset lang
      // response.infoLog += `Subtitle[${stream.index}], ${lang} -> `;
      if (lang === "und") {
        lang = fixLang(lang, stream, track);
        if (lang !== "und")
          needModifySubtitle = true;
      }
      // response.infoLog += ` ${lang} -> `;
      if (lang === "und" && track !== undefined
          && track.Format !== "PGS" && track.Format !== "VobSub") {
        // tmp file
        let sub = require('path').join(librarySettings.cache, 
          "subs-" + require('crypto').randomBytes(16).toString('hex') + ".srt");
        // extract sub
        require("child_process").execSync(
          `ffmpeg -threads 4 -loglevel warning -sub_charenc utf8 -i "${file.file}" -map 0:${stream.index} ${sub}`);
        // guess
        guessLangInfo = guessSubLang(sub);
        if (guessLangInfo !== undefined) {
          // either delete or update
          needModifySubtitle = true;
          lang = guessLangInfo.lang;
        }
        // delete sub
        require('fs').unlinkSync(sub)
      }
      // response.infoLog += ` ${lang} \n`;

      // 只保留中英字幕
      if (LangMap.zh.alias.indexOf(lang) < 0 && LangMap.en.alias.indexOf(lang) < 0 && lang !== 'und') {
        // remove  
        needModifySubtitle = true;
        response.infoLog += `Subtitle[${stream.index}], ${lang}, ${title}, ${stream.codec_name} -> removed \n`;
      }
      else {
        let sub = { "outputStreamIndex":outputStreamIndex, "stream":stream, "lang":lang };

        if (LangMap.zh.alias.indexOf(lang) >= 0)
          subStreams.zh.push(sub);
        else if (LangMap.en.alias.indexOf(lang) >= 0)
          subStreams.en.push(sub);
        else
          subStreams.und.push(sub);

        if (stream.disposition !== undefined && stream.disposition.default === 1)
          defaultSub = sub;

        extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;

        let langInfo = LangMap[lang];
        // set lang
        if (lang !== undefined && lang !== 'und' && langInfo !== undefined) {
          let ffmpegLang = langInfo.ffmpeg;
          extraArguments += ` -metadata:s:${outputStreamIndex} language=${ffmpegLang}`; // s: for stream
        }
        // set title
        if ((title === 'und' || title === undefined)) {
          if (guessLangInfo !== undefined) 
            title = guessLangInfo.title;
          if ((title === 'und' || title === undefined) && langInfo !== undefined)
            title = langInfo.title[0];
          if (title !== 'und' && title !== undefined) {
            needModifySubtitle = true;
            extraArguments += ` -metadata:s:${outputStreamIndex} title="${title}"`; // s: for stream
          }
        }
        response.infoLog += `Subtitle[${stream.index}], ${lang}, ${title}, ${stream.codec_name} -> [${outputStreamIndex}], copy\n`;
        outputStreamIndex++;
      }
    }
  }
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    let stream = file.ffProbeData.streams[i];
    let track = findTrack(file, stream);
    let title = findTitle(stream, track);
    if (stream.codec_type.toLowerCase() !== 'video' &&
        stream.codec_type.toLowerCase() !== 'audio' &&
        stream.codec_type.toLowerCase() !== 'subtitle') {
      // extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
      // outputStreamIndex++;
      // mkv only supports audio/video/subtitle
      response.infoLog += `Stream[${stream.index}], ${title}, ${stream.codec_name} -> removed\n`;      
      needDiscardExtra = true;
    }
  }

  // all audio removed according to the rules, fallback to remove nothing  
  if (Object.keys(audioMap).length === 0) {    
    audioMap = audioMapDel;
    audioMapDel = {};
  }
  // select audio
  for (lang in audioMap) {
    let audioArray = audioMap[lang];
    audioArray.sort(function(a, b) {
      if (a.channels > b.channels)
        return -1;
      if (a.channels < b.channels)
        return 1;
      return a.index - b.index;
    });
    // copy until default
    for (let i = 0; i < audioArray.length; i++) {
      let stream = audioArray[i];
      let track = findTrack(file, stream);
      let title = findTitle(stream, track);
      let defaultFlag = 0;
      if (stream.disposition !== undefined && stream.disposition.default === 1)
        defaultFlag = 1;

      let acodec = 'copy';
      if (stream.codec_name === "pcm_bluray") {
        // mkv doesn't support pcm_bluray
        acodec = `pcm_s16le`;
        if (track !== undefined) {
          if (Number(track.BitDepth) == 16)
            acodec = `pcm_s16le`;
          if (Number(track.BitDepth) == 24)
            acodec = `pcm_s24le`;
          if (Number(track.BitDepth) == 32)
            acodec = `pcm_s32le`;   
        }     
        needModifyAudio = true;         
      }
      if ( stream.channels == 2 && 
          ( stream.codec_name !== "aac" || 
            // not common aac profile
            (stream.profile !== "LC" && stream.profile !== "HE-AAC" && stream.profile !== "HE-AACv2" && stream.profile !== "LD" && stream.profile !== "ELD") 
            ) ) {
        // stereo aac has best compatibility
        let bitrate = getTrackBitrate(stream, track);        
        
        let aacVbr = '5';
        acodec = `libfdk_aac -profile:${outputStreamIndex} aac_he_v2 -vbr:${outputStreamIndex} ${aacVbr}`;
        needModifyAudio = true;         
      }
      if (needModifyAudio)
        acodec += ` -disposition:${outputStreamIndex} ${defaultFlag}`;
      
      extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} ${acodec}`;
      if (title !== undefined) {
        title = title.split('"').join('');
        if (track !== undefined && track.Format_Commercial_IfAny !== undefined && track.Format_Commercial_IfAny.includes('Dolby Atmos')) {
          // mark dolby atmos
          if (!title.toLowerCase().includes('dolby atmos')) {    
            title += ' Dolby Atmos';
            needModifyAudio = true;         
          }
        }
      }
      else if (track !== undefined) {
        title = track.Format_Commercial_IfAny;
        if (title !== undefined)
          needModifyAudio = true;         
      }
      if (title !== undefined)
        extraArguments += ` -metadata:s:${outputStreamIndex} title="${title}"`; // s: for stream       
      if (LangMap.hasOwnProperty(lang)) {
        ffmpegLang = LangMap[lang].ffmpeg;
        extraArguments += ` -metadata:s:${outputStreamIndex} language=${ffmpegLang}`; // s: for stream
      }

      response.infoLog += infoAudio(file, stream, `[${outputStreamIndex}] ${acodec}`);
      outputStreamIndex++;
      if (lang !== 'und') {
        let skipOther = false;
        if (defaultFlag === 1) {
          if (track !== undefined) {
            if (track.Format_Commercial_IfAny === undefined)
              skipOther = true;
            else if (!track.Format_Commercial_IfAny.includes('Dolby Atmos'))
              skipOther = true;
          }
        }
        if (skipOther) {
          for (i++; i < audioArray.length; i++) {
            stream = audioArray[i];
            response.infoLog += infoAudio(file, stream, 'removed');
            needModifyAudio = true;
          }
          break;
        }
      }
    }
  }
  for (lang in audioMapDel) {
    let audioArray = audioMapDel[lang];
    for (let i = 0; i < audioArray.length; i++) {
      let stream = audioArray[i];
      response.infoLog += infoAudio(file, stream, 'removed');
      needModifyAudio = true;
    }
  }

  // select default subtitle
  if (defaultSub !== undefined && defaultSub.lang === LangMap.zh.alias[0]) {
    // good, do nothing
  }
  else if (defaultSub === undefined) {        
    if (subStreams.zh.length > 0)
      defaultSub = subStreams.zh[0];
    else if (subStreams.en.length > 0)
      defaultSub = subStreams.en[0];
    else if (subStreams.und.length > 0)
      defaultSub = subStreams.und[0];
    if (defaultSub !== undefined) {  
      extraArguments += ` -disposition:${defaultSub.outputStreamIndex} default`;
      response.infoLog += `Subtitle default -> [${defaultSub.stream.index}]\n`;
      needModifySubtitle = true;
    }
  }
  else {
    // non-chinese sub
    if (subStreams.zh.length > 0) {
      let newSelection = subStreams.zh[0];
      extraArguments += ` -disposition:${defaultSub.outputStreamIndex} 0 -disposition:${newSelection.outputStreamIndex} default`;
      response.infoLog += `Subtitle default [${defaultSub.stream.index}] -> [${newSelection.stream.index}]\n`;
      needModifySubtitle = true;
    }
  }

  if (!needModifyVideo && !needModifyAudio && !needModifySubtitle && !needDiscardExtra && response.container === file.container ) {
    response.processFile = false;
    response.infoLog += `File doesn't need optimize \n`;
    return response;
  }
  else {
    maxFrameBitrate *= 2;
    maxFrameBitrate = parseInt(maxFrameBitrate);
    // randomize queue size to work around tdarr "same argument as last time" bug ?
    let queueSize = 9999;// + Math.floor(Math.random() * 10000);
    response.preset += `, -movflags use_metadata_tags ${extraArguments} -max_muxing_queue_size ${queueSize}`;
    response.processFile = true;
  }
  return response;
}
module.exports.details = details;
module.exports.plugin = plugin;
