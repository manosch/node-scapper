import axios from 'axios';
import rateLimit from 'axios-rate-limit';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';

const baseUrl = `https://guitarpatches.com/patches.php?unit=G1`;
const http = rateLimit(axios.create(), { maxRequests: 18, perMilliseconds: 1000, maxRPS: 20 })

const getSongs = (pageData) => {
	const songsArr = [];
	let $ = loadCheerio(pageData);
	$(getSongsTable('table.lists', $)).first().find('tbody > tr').each(function () {
		let title = $($(this).find('td')[0]).text().trim();
		let link = $($(this).find('td')[0]).find('a').attr('href').trim();
		let id = getSongId(link);
		let artist = $($(this).find('td')[1]).text().trim();
		let date = $($(this).find('td')[5]).text().trim();
		let uploader = $($(this).find('td')[6]).text().trim();
		songsArr.push({ title, link, artist, id, date, uploader });
	});
	return songsArr;
}

const getSongMetadata = async (song) => {
	let $ = loadCheerio(await getPageData(`${baseUrl}&mode=show&ID=${song.id}`));
	let patches = []
	let params = [];

	$('.glassbox > .gradback').first().find('.paramheader').each(function (index) {

		const [patchTitle, patchValue] = $(this).text().trim().split(':')
		params = [];
		$(this).nextUntil('.clear').each(function () {
			const [paramName, paramValue] = $(this).text().trim().split(':');
			params.push({ paramName, paramValue })
		});
		patches.push({ patchTitle, patchValue: patchValue.trim(), params });
	});
	return patches;
}

const getSongId = (songLink) => {
	const segments = String(songLink).split('&')
	return String(songLink).split('&')[segments.length - 1].split('=')[1]
}

const getSongsTable = (selector, $) => {
	return $(selector).first();
}

const getTotalPages = ($) => {
	const length = $(getSongsTable('table.lists', $)).find('tfoot > tr > td > div.paginate > a').length
	let pages = 1;
	$(getSongsTable('table.lists', $)).find('tfoot > tr > td > div.paginate > a').each(function (index) {
		if (index === length - 2) {
			pages = Number($(this).text().trim());
		}
	});
	return pages;
}

const getPageData = async (url) => {
	console.log('Processing url: ', url);
	const response = await http.get(url).catch((err) => console.log(err));

	if (!response) {
		console.log("Error occurred while fetching data");
		return '';
	}
	return response.data;
}

const loadCheerio = (html) => {
	return cheerio.load(html);
}

const writeSongs = async (songs) => {
	try {
		await fs.writeFile('songs.json', JSON.stringify(songs));
	} catch (err) {
		console.log(err);
	}
}

const loadSongsList = async () => {
	let $ = loadCheerio(await getPageData(baseUrl));

	const urls = Array(getTotalPages($))
		.fill(null)
		.map((item, index) => `${baseUrl}&page=${index + 1}`);

	const songsData = urls
		.map(url => getPageData(url));

	return (await Promise.allSettled(songsData))
		.map(result => result.value).map(page => getSongs(page)).flat();
}

const loadSongsWithMetadata = async () => {
	let songs = await loadSongsList();
	songs = songs.map(async (song) => {
		return {
			...song,
			patches: await getSongMetadata(song)
		}
	})
	return (await Promise.allSettled(songs)).map(result => result.value)
}

const writeSongsWithMetadata = async () => {
	await writeSongs(await loadSongsWithMetadata())
}

await writeSongsWithMetadata()