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
    if (track.StreamOrder === undefined)
      continue;
    if (Number(track.StreamOrder) == stream.index)
      return track;
  }
}

function getTrackBitrate(track)
{
  let bitrate = track.BitRate;
  if (bitrate === undefined)
    bitrate = track.BitRate_Nominal;
  if (bitrate === undefined)
    return "?";
  return Number(bitrate) / 1000;
}
function calTotalBitrate(file)
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
  return ~~(file.file_size / (duration * 0.0075));
}

function findTitle(stream, track)
{
  let title = undefined;
  if (track !== undefined)
    title = track.Title;
  if (title === undefined && stream.tags !== undefined)
    title = stream.tags.title;
  if (title === undefined)
    title = "noname";
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

const zhAlias = ['zh', 'chi', 'chn', 'cn', 'zho'];
const enAlias = ['en', 'eng'];
const jpAlias = ['jp', 'ja', 'jpn', 'jp'];
const krAlias = ['kor', 'kr'];
const frAlias = ['fr', 'fre', 'fra', 'fro', 'frm'];
const geAlias = ['gem', 'ger', 'deu', 'de', 'gmh', 'goh'];
const spaAlias = ['spa', 'es'];

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

function infoVideo(file, stream, action)
{
  let track = findTrack(file, stream);
  let bitrate = getTrackBitrate(track);
  if (bitrate === '?')
    bitrate = calTotalBitrate(file) + "?";
  let title = findTitle(stream, track);
  let bitDepth = "8-bit";
  if (stream.profile === 'High 10' || stream.bits_per_raw_sample === '10')
     bitDepth = "10-bit";
  return `Video[${stream.index}], ${title}, ${stream.codec_name} `
  + `${track.Width}x${track.Height} ${bitrate}k ${bitDepth} -> ${action} \n`;
}

function infoAudio(file, stream, action)
{
  let track = findTrack(file, stream);
  let bitrate = getTrackBitrate(track);
  let title = findTitle(stream, track);
  let lang = getLang(stream, track);
  return `Audio[${stream.index}], ${title}, ${lang}, ${stream.codec_name} `
  + `[${track.ChannelLayout}] ${bitrate}k -> ${action} \n`; 
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

function plugin(file, librarySettings, inputs) {
  const response = {
    processFile: false,
    preset: '',
    handBrakeMode: false,
    FFmpegMode: true,
    reQueueAfter: true,
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
  let needModifyVideo = false;
  let needModifyAudio = false;
  let needModifySubtitle = false;
  let maxFrameBitrate = 0;
  let noAudioCopied = true;
  let outputStreamIndex = 0;
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
      if (track.Width > 640)
        targetBitrate = 3200; // sd
      if (track.Width > 1280)
        targetBitrate = 7200; // 1k
      if (track.Width > 1920)
        targetBitrate = 18000; // 2k
      if (track.Width > 2560)
        targetBitrate = 28780; // 4k
      if (track.Width > 3840)
        targetBitrate = 115139; // 8k

      // check bitrate
      let currentBitrate = getTrackBitrate(track);
      if (currentBitrate === '?') {
        currentBitrate = calTotalBitrate(file);
      }
      // Check if video stream is HDR or 10bit
      let bitDepth = "8-bit";
      if (stream.profile === 'High 10' || stream.bits_per_raw_sample === '10') {
        bitDepth = "10-bit";
        targetBitrate *= 1.25;
      }

      if (targetBitrate >= currentBitrate) {
        extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
        response.infoLog += infoVideo(file, stream, `[${outputStreamIndex}] copy`);
        outputStreamIndex++;
        continue;
      }
      else {
        // re-encode
        needModifyVideo = true;
        minBitrate = parseInt(targetBitrate * 0.6);
        maxBitrate = parseInt(targetBitrate * 1.4);
        if (maxBitrate > currentBitrate)
          maxBitrate = parseInt(currentBitrate);
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

    else if (stream.codec_type.toLowerCase() === 'audio') {
      let lang = getLang(stream, track).toLowerCase();
      let removeAudio = false;
      if (audio_remove_except.length > 0) {
        if (!matchListAny(lang, audio_remove_except)) {
          // response.infoLog += `Unkeep codec : ${audio_remove_except} : ${audio_remove_except.length} : ${lang}\n`;
          removeAudio = true;
        }
      }
      if (audio_remove.length > 0) {
        if (matchListAny(lang, audio_remove)) {
          // response.infoLog += `Remove codec : ${audio_remove} : ${audio_remove.length} : ${lang}\n`;
          removeAudio = true;
        }
      }
      if (audio_title_remove.length > 0) {
        if (includesListAny(title.toLowerCase(), audio_title_remove)) {
          // response.infoLog += `Remove title : ${audio_title_remove} : ${audio_title_remove.length} : ${lang}\n`;
          removeAudio = true;
        }
      }
      if (removeAudio) {
        // skip
        needModifyAudio = true;
        response.infoLog += infoAudio(file, stream, 'removed');
      }
      else {
        noAudioCopied = false;
        extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
        response.infoLog += infoAudio(file, stream, `[${outputStreamIndex}] copy`);
        outputStreamIndex++;
      }
    }

    else if (stream.codec_type.toLowerCase() === 'subtitle') {
      let lang = getLang(stream, track).toLowerCase();
      if (zhAlias.indexOf(lang) < 0 && enAlias.indexOf(lang) < 0 && lang !== 'und') {
        // remove  
        needModifySubtitle = true;
        response.infoLog += `Subtitle[${stream.index}], ${lang}, ${title}, ${stream.codec_name} -> removed \n`;
      }
      else {
        extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
        response.infoLog += `Subtitle[${stream.index}], ${lang}, ${title}, ${stream.codec_name} -> [${outputStreamIndex}] copy\n`;
        outputStreamIndex++;
      }
    }

    else {
      extraArguments += ` -map 0:${stream.index} -c:${outputStreamIndex} copy`;
      response.infoLog += `Stream[${stream.index}], ${title}, ${stream.codec_name} -> [${outputStreamIndex}] copy\n`;
      outputStreamIndex++;
    }
  }

  if (noAudioCopied) {
    // all audio removed according to the rules
    needModifyAudio = false;
    extraArguments += ` -map 0:a -c:a copy`;
    response.infoLog += `Audio rule failed, keep all audio\n`;
  }

  if (!needModifyVideo && !needModifyAudio && !needModifySubtitle) {
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
