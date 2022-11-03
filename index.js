import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';

let songs = [];
const baseUrl = `https://guitarpatches.com/patches.php?unit=G1`;

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
	let response = await axios(url).catch((err) => console.log(err));
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

await writeSongs(await loadSongsList());