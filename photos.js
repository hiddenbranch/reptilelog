/* Species photos from Wikimedia Commons. Pure helpers here (testable in node); the fetch-and-cache flow lives in app.js.
   Only images under a free licence are shown, always with author, licence and a link back. */
(function (root) {
  'use strict';
  const P = {};
  P.SUMMARY_URL = title => 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(String(title).replace(/ /g, '_'));
  P.SEARCH_URL = q => 'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=' + encodeURIComponent(q);
  P.COMMONS_URL = file => 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=640&titles=' + encodeURIComponent('File:' + file);
  // The file name is the last path segment of the image URL, e.g. .../commons/thumb/a/ab/Foo.jpg/320px-Foo.jpg -> Foo.jpg
  P.fileNameFromUrl = function (url) {
    if (!url) return null;
    // Wikipedia appends tracking parameters (?utm_source=...) to image URLs; drop the query and fragment first
    const clean = String(url).split('#')[0].split('?')[0];
    const parts = clean.split('/');
    let name = parts[parts.length - 1];
    const m = name.match(/^\d+px-(.+)$/); if (m && parts.length > 2 && parts[parts.length - 2] === m[1]) name = m[1]; else if (m) name = m[1];
    try { name = decodeURIComponent(name); } catch (e) { /* keep as is */ }
    return name || null;
  };
  P.FREE = /^(cc0|cc by|cc-by|cc by-sa|cc-by-sa|public domain|pd|gfdl|attribution|fal|cc-zero)/i;
  P.isFreeLicense = lic => !!lic && P.FREE.test(String(lic).trim()) && !/nc|nd/i.test(String(lic).replace(/^cc[ -]by/i, ''));
  P.stripHtml = s => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  // Turn a Commons imageinfo response into the record the app stores.
  P.parseCommons = function (json, fileName) {
    const pages = json && json.query && json.query.pages; if (!pages) return null;
    const page = Object.values(pages)[0]; if (!page || page.missing !== undefined || !page.imageinfo || !page.imageinfo[0]) return null;
    const ii = page.imageinfo[0]; const md = ii.extmetadata || {};
    const license = md.LicenseShortName && md.LicenseShortName.value;
    if (!P.isFreeLicense(license)) return null;
    const artist = P.stripHtml(md.Artist && md.Artist.value) || 'Unknown author';
    return { file: fileName, thumb: ii.thumburl || ii.url, url: ii.url, page: ii.descriptionurl || ('https://commons.wikimedia.org/wiki/File:' + fileName), artist: artist.slice(0, 80), license, licenseUrl: md.LicenseUrl && md.LicenseUrl.value || '' };
  };
  P.caption = rec => `Photo: ${rec.artist}, ${rec.license}, via Wikimedia Commons`;
  if (typeof module !== 'undefined' && module.exports) module.exports = P; else root.RLPhotos = P;
})(typeof window !== 'undefined' ? window : globalThis);
