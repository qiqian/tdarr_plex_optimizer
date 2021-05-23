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
  }
}

function getTrackBitrate(track)
{
  let bitrate = undefined;
  if (track !== undefined) {
    bitrate = track.BitRate;
    if (bitrate === undefined)
      bitrate = track.BitRate_Nominal;  
  }
  if (bitrate === undefined)
    return "?";
  return Number(bitrate) / 1000;
}
function calTotalBitrate(file, track)
{
  // Check if duration info is filled, if so times it by 0.0166667 to get time in minutes.
  // If not filled then get duration of stream 0 and do the same.
  let duration = '';
  if (typeof file.meta.Duration !== 'undefined') {
    duration = file.meta.Duration * 0.0166667;
  } else {
    duration = file.ffProbeData.streams[0].duration * 0.0166667;
  }
  // Work out currentBitrate using "Bitrate = file size / (number of minutes * .0075)"
  // Used from here https://blog.frame.io/2017/03/06/calculate-video-bitrates/
  // eslint-disable-next-line no-bitwise
  let streamSize = file.file_size;
  if (track !== undefined && track.StreamSize !== undefined) {
    streamSize = Number(track.StreamSize)
  }
  return ~~(streamSize / (duration * 0.0075));
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
  if (lang !== 'und')
    return lang;
  let title = findTitle(stream, track);
  if (includesListAny(title.toLowerCase(), zhTitle))
    return zhAlias[0];
  if (includesListAny(title.toLowerCase(), enTitle))
    return enAlias[0];
  if (includesListAny(title.toLowerCase(), jpTitle))
    return jpAlias[0];
  return 'und';
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

const zhAlias = ['zh', 'chi', 'chn', 'cn', 'zho'];
const enAlias = ['en', 'eng'];
const jpAlias = ['ja', 'jpn', 'jp', 'jap'];
const krAlias = ['kor', 'kr'];
const frAlias = ['fr', 'fre', 'fra', 'fro', 'frm'];
const geAlias = ['gem', 'ger', 'deu', 'de', 'gmh', 'goh'];
const spaAlias = ['spa', 'es'];
const zhTitle = ['中文', '国语', '汉语', '国配', '台配', '辽艺', '普通话', 'Chinese'];
const enTitle = ['英语', '英文', 'English'];
const jpTitle = ['日语', '日文', 'Japanese'];
const ffmpegLangDict = { 'zh' : 'chi', 'en' : 'eng', 'ja' : 'jpn' };

function fillLangAlias(langList)
{  
  fillLangAlias_set(langList, zhAlias);
  fillLangAlias_set(langList, enAlias);
  fillLangAlias_set(langList, jpAlias);
  fillLangAlias_set(langList, krAlias);
  fillLangAlias_set(langList, frAlias);
  fillLangAlias_set(langList, geAlias);
  fillLangAlias_set(langList, spaAlias);
}

function normalizeLang(lang)
{  
  if (zhAlias.indexOf(lang) >= 0)
    return zhAlias[0];
  if (enAlias.indexOf(lang) >= 0)
    return enAlias[0];
  if (jpAlias.indexOf(lang) >= 0)
    return jpAlias[0];
  if (krAlias.indexOf(lang) >= 0)
    return krAlias[0];
  if (frAlias.indexOf(lang) >= 0)
    return frAlias[0];
  if (geAlias.indexOf(lang) >= 0)
    return geAlias[0];
  if (spaAlias.indexOf(lang) >= 0)
    return spaAlias[0];
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
  let bitrate = getTrackBitrate(track);
  let title = findTitle(stream, track);
  let lang = getLang(stream, track);
  return `Audio[${stream.index}], ${title}, ${lang}, ${stream.codec_name} `
  + `${bitrate}k -> ${action} \n`; 
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

function infoVideo(file, stream, action)
{
  let track = findTrack(file, stream);
  let bitrate = getTrackBitrate(track);
  if (bitrate === '?')
    bitrate = calTotalBitrate(file, track) + "?";
  let title = findTitle(stream, track);
  let bitDepth = "8-bit";
  if (stream.profile === 'High 10' || stream.bits_per_raw_sample === '10')
     bitDepth = "10-bit";
  return `Video[${stream.index}], ${title}, ${stream.codec_name} `
  + `${stream.width}x${stream.height} ${bitrate}k ${bitDepth} -> ${action} \n`;
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

  // Go through each stream in the file.
  for (let i = 0; i < file.ffProbeData.streams.length; i++) {
    let stream = file.ffProbeData.streams[i];
    let track = findTrack(file, stream);
    let title = findTitle(stream, track);
    // Check if stream is a video.
    if (stream.codec_type.toLowerCase() === 'video') {
      // Check if codec of stream is mjpeg/png, if so then remove this "video" stream.
      // mjpeg/png are usually embedded pictures that can cause havoc with plugins.
      if (stream.codec_name === 'mjpeg' || stream.codec_name === 'png') {
        extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
        response.infoLog += infoVideo(file, stream, `[${outputStreamIndex}] copy`);
        outputStreamIndex++;
        continue;
      }
      // Check if codec of stream is hevc or vp9 AND check if file.container matches inputs.container.
      // If so nothing for plugin to do.
      if (stream.codec_name === 'hevc' || stream.codec_name === 'vp9') {
        extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
        response.infoLog += infoVideo(file, stream, `[${outputStreamIndex}] copy`);
        outputStreamIndex++;
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

      // check bitrate
      let currentBitrate = getTrackBitrate(track);
      if (currentBitrate === '?') {
        currentBitrate = calTotalBitrate(file, track);
      }
      // Check if video stream is HDR or 10bit
      let bitDepth = "8-bit";
      if (stream.profile === 'High 10' || stream.bits_per_raw_sample === '10' || stream.pix_fmt == 'yuv420p10le' ||
          track.Format_Profile === 'High 10' || track.BitDepth === '10') {
        bitDepth = "10-bit";
        targetBitrate *= 1.25;
      }

      if (targetBitrate >= currentBitrate) {
        extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
        response.infoLog += infoVideo(file, stream, `[${outputStreamIndex}] copy`);
        outputStreamIndex++;
        continue;
        //targetBitrate = currentBitrate;
        //minBitrate = parseInt(targetBitrate * 0.9);
        //maxBitrate = parseInt(targetBitrate * 1.1);
      }
      else {
        // re-encode        
        minBitrate = parseInt(targetBitrate * 0.6);
        maxBitrate = parseInt(targetBitrate * 1.4);
        if (maxBitrate > currentBitrate)
          maxBitrate = parseInt(currentBitrate);
      }

      needModifyVideo = true;
      maxFrameBitrate += maxBitrate;

      extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} libx265 `
      + `-b:${stream.index} ${targetBitrate}k `
      + `-minrate:${stream.index} ${minBitrate}k `
      + `-maxrate:${stream.index} ${maxBitrate}k `;
      if (bitDepth === "10-bit") {
        extraArguments += " -pix_fmt yuv420p10le";
      }
      response.infoLog += infoVideo(file, stream, 
        `[${outputStreamIndex}] x265 ${targetBitrate}k ${bitDepth}`);
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
      if (zhAlias.indexOf(lang) < 0 && enAlias.indexOf(lang) < 0 && lang !== 'und') {
        // remove  
        needModifySubtitle = true;
        response.infoLog += `Subtitle[${stream.index}], ${lang}, ${title}, ${stream.codec_name} -> removed \n`;
      }
      else {
        let sub = { "outputStreamIndex":outputStreamIndex, "stream":stream, "lang":lang };

        if (zhAlias.indexOf(lang) >= 0)
          subStreams.zh.push(sub);
        if (enAlias.indexOf(lang) >= 0)
          subStreams.en.push(sub);
        else
          subStreams.und.push(sub);

        if (stream.disposition !== undefined && stream.disposition.default === 1)
          defaultSub = sub;

        extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
        response.infoLog += `Subtitle[${stream.index}], ${lang}, ${title}, ${stream.codec_name} -> [${outputStreamIndex}] copy\n`;
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
        if (Number(track.BitDepth) == 16)
          acodec = `pcm_s16le`;
        if (Number(track.BitDepth) == 24)
          acodec = `pcm_s24le`;
        if (Number(track.BitDepth) == 32)
          acodec = `pcm_s32le`;        
        needModifyAudio = true;         
      }
      if (track.CodecID === "A_AAC-1") {
        // plex-android doesn't play A_AAC-1
        acodec = `libfdk_aac -profile:a aac_he_v2 -b:${outputStreamIndex} ${stream.sample_rate}`;
        needModifyAudio = true;         
      }
      if (needModifyAudio)
        acodec += ` -disposition:${outputStreamIndex} ${defaultFlag}`;
      
      extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} ${acodec}`;
      if (title !== undefined)
        extraArguments += ` -metadata:s:${outputStreamIndex} title=${title}`;      
      if (ffmpegLangDict.hasOwnProperty(lang)) {
        ffmpegLang = ffmpegLangDict[lang];
        extraArguments += ` -metadata:s:${outputStreamIndex} language=${ffmpegLang}`;
      }

      response.infoLog += infoAudio(file, stream, `[${outputStreamIndex}] ${acodec}`);
      outputStreamIndex++;
      if (lang !== 'und') {
        if (defaultFlag === 1) {
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
  if (defaultSub !== undefined && defaultSub.lang === zhAlias[0]) {
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

  if (!needModifyVideo && !needModifyAudio && !needModifySubtitle && !needDiscardExtra) {
    response.processFile = false;
    response.infoLog += `File doesn't need optimize \n`;
    return response;
  }
  else {
    maxFrameBitrate *= 2;
    maxFrameBitrate = parseInt(maxFrameBitrate);
    response.preset += `, -movflags use_metadata_tags ${extraArguments} -max_muxing_queue_size 9999 -bufsize ${maxFrameBitrate}k`;
    response.processFile = true;
  }
  return response;
}
module.exports.details = details;
module.exports.plugin = plugin;