/********************************************************************************
*
*	Copyright (c) 2009, Conan Albrecht <conan@warp.byu.edu>
*
*	This program is free software: you can redistribute it and/or modify
*	it under the terms of the GNU General Public License as published by
*	the Free Software Foundation, either version 3 of the License, or
*	(at your option) any later version.
*
*	This program is distributed in the hope that it will be useful,
*	but WITHOUT ANY WARRANTY; without even the implied warranty of
*	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
*	GNU General Public License for more details.
*
*	You should have received a copy of the GNU General Public License
*	along with this program. If not, see <http://www.gnu.org/licenses/>.
*
*********************************************************************************
*
*	JS Jeopardy! is a simple Jeopardy game meant for teachers, presenters, and
*	others. It is written in pure JavaScript, so it doesn't require a web 
*	server, although it can be run from one.
*
*	Installation:
*	1. Unzip the distribution to a directory on your computer.
*	2. Populate the topic-exdata.csv file with categories, questions, and answers.
*	   The first row is always ignored (it's a header). Any questions in
*	   the special category "Final Jeopardy" are shown on the side of the
*	   screen.
*	3. Load index.html into your browser by selecting File | Open from 
*	   your browser's menu. The board should load.
*	4. To customize the background, save a new graphic to wallpaper.jpg.
*	5. To customize the colors and/or fonts, modify the jeopardy.css file.
*
*	Instructions:
*		See the index.html page (near the bottom) for a detailed set of
*		instructions.
* 
*	Note that if you leave the page, refresh the page, or crash your browser,
*	your game is lost. That's the breaks with client-side web. :P
*
*	Enjoy!
*
*********************************************************************************
*			CHANGELOG
* 
* 2009-04-09 First version up and running. Tested in Safari and Firefox.
*            How sweet is Firebug for debugging!
* 2009-04-13 Made changes for IE. After a frustrating afternoon of debugging
*            with little support from IE, it now works there too. :)
* 2009-05-13 Fixed a small loadingAnimation.gif bug.
*            Added an alert if the user doesn't specify any questions.
*
*********************************************************************************/
 
/** The version number of this game */
var VERSION = '0.12b'; 
 
/** The current question being shown */
var currentquestion = null;

/** Holds all categories and questions */
var categories = [];

/** Holds the player information */
var players = [];

/////////////////////////////////////////////////////////////////////////////////////
//   DELIMITED TEXT READING FUNCTIONS
//

/** A few Javascript additions to mimic Java string methods */
String.prototype.trim = function() { return (this.replace(/^[\s\xA0]+/, '').replace(/[\s\xA0]+$/, '')) }
String.prototype.startsWith = function(str) { return (this.match('^'+str)==str) }
String.prototype.endsWith = function(str) {return (this.match(str+'$')==str) }
String.prototype.replaceAll = function(orig, repl) { var temp = this; while (temp.indexOf(orig) >= 0) { temp = temp.replace(orig, repl); } return temp; }

/** Checks the given field to see if it ends with a qualifier. */
function isEndQualifier(field, qualifier) {
	var qualifiers = qualifier;
	var numQualifiers = 0;
	while (field.endsWith(qualifiers)) {
		numQualifiers++;
		qualifiers += qualifier;
	}//while
	return numQualifiers % 2 == 1;
}//isEndQualifier

/** Converts delimited text (CSV, TSV) to a two dimensional array */
function convert_csv(csv_text, delimiter, qualifier) {
	// w01f: why not counting seperators in definition?
//	delimiter = delimiter === undefined ? ',' : delimiter;
//	qualifier = qualifier === undefined ? '"' : qualifier;
	// w01f: now recognize majority of probable symbols for more compatibility to e.g. excel (german delimiter is semicolon)
	// todo: create a funtion to check more typical chars in an array (like tabulator(8), pipe, space(32), dot, colon)->[',',';',"\t",'|',' ','.',':']
	if (delimiter === undefined){
		delimiter = ((csv_text.split(',').length-1) > (csv_text.split(';').length-1))?',':';';
	}
	// todo: .. same funtion here .. -> ['"',"'",'´','`']
	if (qualifier === undefined){
		qualifier = ((csv_text.split('"').length-1) > (csv_text.split("'").length-1))?'"':"'";
	}

	// w01f: why not \r->\n, \n\n->\n ? does anyone need empty lines? (guess: no)
	csv_text = csv_text.replaceAll("\r\n", "\n").replaceAll("\r", "\n"); // convert all files to Unix-style line endings
	var data = [];
	var doublequalifier = qualifier + qualifier;
	var lines = csv_text.split("\n");

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];
		var record = [];
		var fields = line.split(delimiter);
		var combofield = null;
		for (var j = 0; j < fields.length; j++) {
			var field = fields[j].toString();
			if (combofield == null) { // we're not in quotes at the moment
				if (field.startsWith(qualifier) && isEndQualifier(field, qualifier)) { 
					// if the field starts and ends with a qualifier, remove the qualifiers and add the field
					field = field.substr(qualifier.length, field.length - (qualifier.length*2)); // take off the qualifier
					field = field.replaceAll(doublequalifier, qualifier); // for any qualifiers within the text that were doubled
					record[record.length] = field.toString();
				}else if (field.startsWith(qualifier)) { 
					// if the field starts with a qualifier but doesn't end with one, we have to start quotes mode
					combofield = field.substr(qualifier.length).toString(); // take the qualifier off the beginning
				}else{
					// the field doesn't have qualifiers, so just add the field
					field = field.replaceAll(doublequalifier, qualifier); // for any qualifiers within the text that were doubled
					record[record.length] = field.toString();
				}//if
			}else{ // we're in quotes mode at the moment
				if (isEndQualifier(field, qualifier)) {
					// we found the end qualifier, so add the combofield
					combofield += delimiter + field.substr(0, field.length - qualifier.length); // take off the qualifier
					combofield = combofield.replaceAll(doublequalifier, qualifier); // for any qualifiers within the text that were doubled
					record[record.length] = combofield.toString();
					combofield = null; 
				}else{
					// we haven't found the end qualifier, so just append the field to combofield and go to the next one
					combofield += delimiter + field.toString();
				}//if
			}//if
		}//for
		data[data.length] = record;
	}//for
	return data;
}//convert_csv

/////////////////////////////////////////////////////////////////////////////////////
//   Factory functions to create objects
//

/** Creates a question object */
function createQuestion(category, points, answer, question) {
	return {
		'finaljeopardy'	: false,
		'category'	: category.toString(),
		'points'	: points,
		'answer'	: answer.toString(),
		'question'	: question.toString(),
		'gridid'	: '' // set when placed on the screen
	};
}

/** Creates a player object */
function createPlayer(name) {
	return {
		'name' : name.toString(),
		'score' : 0
	};
}//createPlayer

/////////////////////////////////////////////////////////////////////////////////////
//	Main method of the program (called by the HTML page when loading is finished)
//

/** Loads the game data */
function loadGame() {
	// parse the csv_text into an array of question objects
	// this loads the questions into an ordered array, even if the user has them
	// out of order in the data file
	var data = convert_csv($('textarea#setupdata').html());
	// w01f:
	// todo: merge multiple data in an array referenced by points
// d[category][points]=data[] //=> d[col][row]
	// w01f: how to get a random elm of an array when multiple are there
	// and get one of probably multiple questions per points/category
//function getRandomArrayElement(array){
//	return array[(parseInt(Math.random() * array.length))];
//}

/** w01f: currency (later on depending on language) */
	cur = $('#currency').html().trim();
	cur_first = parseInt($('#currency_first').html());

	var max_questions_in_category = 0;
	categories[0] = []; // add a hard coded element for final jeopardy
	
	$('div.credits').removeClass('hidden');
	
	for (var i = 1; i < data.length; i++) { // skip the header row
		if (data[i].length >= 4) {
			var question = createQuestion(data[i][0], (parseInt(data[i][1]) ? parseInt(data[i][1]) : 0), data[i][2], data[i][3]);
			// find the category for this question (even if they are out of order in the CSV file)
			var index = 0;
			if (question.category.toLowerCase() == 'final jeopardy') {
				question.finaljeopardy = true;
			}else{
				for (index = 1; index < categories.length; index++) {
					if (categories[index][0].category.trim() == question.category.trim()) { break; }
				}
				// if a new category name, add it to the categories list
				if (index == categories.length) {
					categories[index] = [];
				}
			}//if
			// add the question to this category
			categories[index][categories[index].length] = question;
			max_questions_in_category = Math.max(max_questions_in_category, categories[index].length);
		}//if
	}//for i

	// ensure we have some questions
	// w01f: moved to index.html: "You didn't specify any questions, or you didn't format them correctly. You may want to try loading the example game data for a demo (click the yellow link just above the text box)."
	if (categories.length <= 1) { 
		alert($('#err_categories_length').html());
		return;
	}

	// create the table grid (category headers first, then grid items)
	var cellwidth = parseInt(100 / categories.length);
	var html = '<table class="grid"><tr>';
	for (var col = 1; col < categories.length; col++) {
		html += '<td width="' + cellwidth + '%" id="grid' + col + '"><div class="dialog-blue"><div class="content-blue"><div class="t-blue"></div><div id="gridheader' + col + '" class="gridheader">' + categories[col][0].category + '</div></div><div class="b-blue"><div></div></div></div></td>';
	}//for col
	html += '</tr>';
	for (var row = 0; row < max_questions_in_category; row++) {
		html += '<tr>';
		for (var col = 1; col < categories.length; col++) {
			var gridid = 'grid' + col + '-' + row;
			question = categories[col][row];
			if (question) {
				question.gridid = gridid;
				html += '<td width="' + cellwidth + '%" onclick="showQuestion(' + row + ', ' + col + ')"><div class="dialog-blue" id="' + gridid + '"><div class="content-blue"><div class="t-blue"></div><div class="griditem">' + ((cur_first)? cur : '' ) + question.points + ((cur_first)? '' : cur ) + '</div></div><div class="b-blue"><div></div></div></div></td>';
			}else{
				html += '<td>&nbsp;</td>';
			}//if
		}//for col
		html += '</tr>';
	}//for row
	html += '</table>';
	$('#griddiv').prepend(html);
	//$('#'+gridid).parent().css('width',cellwidth).click(function(){showQuestion();});

	// set the height of all cells in the header row to be the same height (in case some go multi-line)
	checkHeaderHeight();
	// add players to the board
	var numplayers = parseInt($('#setupnumplayers').val())
	for (var i = 1; i <= numplayers; i++) {
		players[players.length] = createPlayer('Player ' + i);
	}//for
	refreshPlayers();

	// set the final jeopardy questions
	html = '<table class="grid">';
	var col = 0;
	for (var row = 0; row < categories[col].length; row++) {
		var gridid = 'grid' + col + '-' + row;
		question = categories[col][row];
		question.gridid = gridid;
		html += '<tr><td width="' + cellwidth + '%" onclick="showQuestion(' + row + ', ' + col + ')""><div class="dialog-blue" id="' + gridid + '"><div class="content-blue"><div class="t-blue"></div><div class="griditem">' + question.category + '</div></div><div class="b-blue"><div></div></div></div></td></tr>';
	}//for
	html += '</table>';
	$('#finaljeopardydiv').html(html);

	// finally, close the setup dialog
	tb_remove();
}//loadGame function

/** Refreshes the players boxes on the screen */
function refreshPlayers() {
	// set the player list in the main window
	var html = '';
	for (var i = 0; i < players.length; i++) {
		var player = players[i];
		html += '<div class="dialog-black" onclick="editPlayer(' + i + ')"><div class="content-black"><div class="t-black"></div><div class="playerinfo"><div class="playername">' + player.name + '</div><div class="playerscore" id="playerscore' + i + '">' + player.score + '</div></div></div><div class="b-black"><div></div></div></div>'
	}//for i
	$('#players').html(html);

	// set the player grading table in the answer window
	var row1 = '';
	for (var i = 0; i < players.length; i++) {
		var player = players[i];
		row1 += '<td><div id="answerWindowPlayer' + i + '"><div class="answerPlayerName" id="answerPlayerName' + i + '">' + player.name + '</div><div class="answerWindowGrades" id="answerWindowGrade' + i + '"><img src="img/correct.png" onclick="scoreAnswer(true, ' + i + ')">&nbsp;&nbsp;&nbsp;<img src="img/incorrect.png" onclick="scoreAnswer(false, ' + i + ')"></div><div class="answerWindowScores" id="answerscorediv' + i + '"><input type="text" size="7" value="" id="answerscore' + i + '"></div></div></td>';
	}//for i
	$('#questionplayers').html('<table class="questionPlayerTable"><tr>' + row1 + '</tr></table>');
}//refreshPlayers

/** Resizes the column headers to ensure they have the same width. */
function checkHeaderHeight() {
	// this is a total kludge, but it allows me to vertically center the text (which the CSS-based pretty boxes don't let me do otherwise)
	// (todo) w01f: this may have changed in newer css standards?!
	var maxheight = 0;
	for (var col = 1; col < categories.length; col++) {
		maxheight = Math.max(maxheight, $('#gridheader' + col)[0].offsetHeight );
	}//for col
	for (var col = 1; col < categories.length; col++) {
		var gridheader = $('#gridheader' + col);
		front = false;
		while (gridheader[0].offsetHeight < maxheight) {
			if (front) {
				gridheader.prepend('&nbsp;<br>');
			}else{
				gridheader.append('<br>&nbsp;');
			}
			front = !front;
		}
	}//for col
}//checkHeaderSize

/** Edits a player */
function editPlayer(index) {
	var player = players[index];
	$('#editplayerindex').val(index);
	$('#editplayername').val(player.name);
	$('#editplayerscore').val(player.score);
	tb_show('Edit ' + player.name, '#TB_inline?height=250&width=300&inlineId=editPlayerWindow', null);
	$('#editplayername').select();
}//editPlayer

/** Saves edited player changes */
function savePlayer(index) {
	var player = players[index];
	// if changes are made here, they must be replicated in addPlayerAt below
	player.name = $('#editplayername').val();
	var newscore = parseInt($('#editplayerscore').val());
	if (!isNaN(newscore)) {
		player.score = newscore;
	}
	refreshPlayers();
	tb_remove();
}

/** Deletes a player */
function deletePlayer(index) {
	var player = players[index];
	if (players.length <= 1) {
		alert($('#err_players_length').html());
	}else if (confirm($('#q_delete').html() +' '+ player.name + '?')) {
		players.splice(index, 1);
		refreshPlayers();
		tb_remove();
	}
}

/** Adds a player at the specified position */
function addPlayerAt(index) {
	// save content just in case the user modified this user
	var player = (index > players.length) ? players[index] : createPlayer('Player ' + (players.length+1));
	player.name = $('#editplayername').val();
	player.score = parseInt($('#editplayerscore').val());
	players.splice(index, 0, createPlayer('Player ' + (players.length+1)));
	refreshPlayers();
	editPlayer(index);
}

/** Returns whether grid items still exist on the board (not counting final jeopardy) */
function isBoardEmpty() {
	// todo: remove iteration and use jquery filter for speedup
	for (var i = 1; i < categories.length; i++) {
		for (var j = 0; j < categories[i].length; j++) {
			if ($('#'+categories[i][j].gridid).css('visibility') != 'hidden') {
				return false;
			}//if
		}
	}//for
	return true;
}//isBoardEmpty

// w01f: i thought in jeopardy its the answer wich is initially shown?! I should adjust my english, shouldnt I? ;)
/** Shows a question when it is clicked */
function showQuestion(row, col) {
	currentquestion = categories[col][row];
	// if this grid item has been hidden, just show it	
	if ($('#'+currentquestion.gridid).css('visibility') == 'hidden') {
		// w01f: why making visible again?
		// todo: if really wanted, better confirm that?! for now commented
		if(!confirm($('#q_show_answeredquestion').html())){}else{return $('#'+currentquestion.gridid).css('visibility', 'visible');}
	}//if
	// if this is a final jeopardy question and we still have grid items, ask the user if he's sure
	if (currentquestion.finaljeopardy && !isBoardEmpty()) {
		if (!confirm($('#q_final_jeopardy').html())) {
			return;
		}//if
	}//if
	// set up the question dialog
	$('#popuptext').html(currentquestion.answer);
	for (var index = 0; index < players.length; index++) {
		$('#answerscore' + index).val(currentquestion.points);
		$('#answerscorediv' + index).css('visibility', (currentquestion.finaljeopardy ? 'visible' : 'hidden'));
	}//for
	// hide the grid item for this answer
	$('#'+currentquestion.gridid).css('visibility', 'hidden');
	// ensure the answer correct/incorrect divs are visible
	for (var index = 0; index < players.length; index++) {
//		$('#answerPlayerName' + index).css('color', '#FFFFFF');
		$('#answerWindowGrade' + index).css('visibility', 'visible');
		$('#answerWindowPlayer' + index).css('visibility', 'visible');
	}//for
	// show the dialog
	tb_show(currentquestion.category, '#TB_inline?height=300&width=500&inlineId=questionWindow', null);
}//showQuestion

/** Toggles the answer and question in the answer window */
function toggleAnswer(showQuestion) {
	// ensure we are looking at a question
	if (currentquestion == null) {
		return;
	}
	// toggle the question or answer
	if (showQuestion || $('#popuptext').html() == currentquestion.answer) {
		$('#popuptext').html(currentquestion.question);
	}else{
		$('#popuptext').html(currentquestion.answer);
	}//if
}//toggleAnswer

/** Scores an answer for a player */
function scoreAnswer(correct, index) {
	// ensure we are looking at a question
	if (currentquestion == null) {
		return;
	}
	// get the player and add or remove to the score
	var player = players[index];
	var adjustment = (correct ? 1 : -1) * parseInt($('#answerscore' + index).val());
	if (!isNaN(adjustment)) {
		player.score += adjustment;
	}
	// update the player score on the screen
	$('#playerscore' + index).html(player.score);
	// adjust the screen based on the answer the player gave
	if (currentquestion.finaljeopardy) {
		$('#answerscorediv' + index).css('visibility', 'hidden');
		$('#answerWindowGrade' + index).css('visibility', 'hidden');
//		if (correct) {			$('#answerPlayerName' + index).css('color', '#FFFFCC');		}
	}else if (correct) {
//		$('#answerPlayerName' + index).css('color', '#FFFFCC');
		for (var i = 0; i < players.length; i++) {
			$('#answerWindowGrade' + i).css('visibility', 'hidden');
			if (i != index) {
				$('#answerWindowPlayer' + i).css('visibility', 'hidden');
			}//if
		}//for i
	}else { // incorrect
		$('#answerWindowPlayer' + index).css('visibility', 'hidden');
		$('#answerWindowGrade' + index).css('visibility', 'hidden');
	}//if
	// if all are answered, show the question
	var allhidden = true;
	for (var i = 0; i < players.length; i++) {
		if ($('#answerWindowGrade' + i).css('visibility') == 'visible') {
			allhidden = false;
		}
	}
	if (allhidden) {
		toggleAnswer(true);
	}
}//scoreAnswer

/* w01f: loading CVS-Files via ajax */
function readFile(f) {
	var d=false;
	$.ajax({
		type: 'GET',
		url: f.toString(),
		dataType: 'text',
		error: function (xhr, desc, exceptionobj) {
			alert($('#err_data_file').html() + xhr.responseText + exceptionobj );
		},
		success: function (data) {
			$('#setupdata').html(data);
		}
	});
	return d;
}
/** Populates the game setup window with example data */
// w01f: this funtion is not any more only for the example-data, therefore renamed
function setupData(d) {
	// w01f: condition not needed anymore, as this funtion shall load every startup onchange of the selection of a topic
	readFile(d);
}//setupExampleData

// w01f: return the index of edited Player
function getPlayerIndex(){
	return parseInt($('#editplayerindex').val());
}

/** w01f: currency (later on depending on language) */
var cur = '',
	cur_first = '';

	/** Starts the main function in the jeopardy.js file */
// w01f: moved here from index.html
$(document).ready(function() {
	// w01f: hide .jswarning
	$('.jswarning').addClass('hidden');
	// w01f: bind former hardcoded events with jquery
	$('#popuptext').click(function(e){
		e.preventDefault();
		toggleAnswer();
	});
	$('#btnDeleteUser').click(function(e){
		e.preventDefault();
		deletePlayer(getPlayerIndex());
	});
	$('#btnSaveUser').click(function(e){
		e.preventDefault();
		savePlayer(getPlayerIndex());
	});
	$('#btnAddPlayerBefore').click(function(e){
		e.preventDefault();
		addPlayerAt(getPlayerIndex());
	});
	$('#btnAddPlayerAfter').click(function(e){
		e.preventDefault();
		addPlayerAt(getPlayerIndex()+1);
	});
	$('#btnPlayJeopardy').click(function(e){
		e.preventDefault();
		loadGame();
	});
	// w01f: bottons to inc and dec on playernum
	$('.setPlayerNum').each(function(){
		$(this).click(function(e){
			e.preventDefault();
			var $n=parseInt($('#setupnumplayers').val());
			if($(this).val().trim() === '+'){
				$n++;
			}else{
				$n--;
			}
			$('#setupnumplayers').val($n);
		});
	});

	/*
	$('#lnkSetupData').click(function(){
		readFile($('#selTopicFile').val());
	});
	$('#lnkSetupData').addClass('hidden');
	*/
	
	// w01f: add topics as entries in select#selTopicFile
	//todo: autoload repository-csv instead of hardcode that select in index.html
	$('#selTopicFile').append(
		'<option class="topic" id="topic-exdata.en.csv" value="topic-exdata.en.csv">(en) Example Topic</option>'
		+'<option class="topic" id="topic-exdata.de.csv" value="topic-exdata.de.csv">(de) Beispiel-Thema</option>'
	).change(function(){
		var topic = $('#selTopicFile').val();
		
		if (topic === '') {
			$('#editTopic').removeClass('hidden');
		} else {
			$('#editTopic').addClass('hidden');
		}
		if (topic !== '') {
			readFile(topic);
		}
		//$('#lnkTopicFile').attr('href','topic');
		//todo: check if file was loaded correctly, indicate the result
	});
	
	//todo: add lang-support
	//load languages.csv and add included languages as click-/selectable in setupscreen

	// w01f: start orig. game-loader - former function main()
	document.title = 'JS Jeopardy! v' + VERSION;
	// show the game setup dialog
	tb_show('JS Jeopardy', '#TB_inline?height=500&width=800&inlineId=setupWindow&modal=true', null);
	// w01f: prevent horizontal scrollbar
	$('textarea').css('width','100%');
	$('#appname').append('&nbsp;V'+VERSION);
	$('div#TB_window > div#TB_ajaxContent').before($('div.credits:last').clone().removeClass('hidden').css('background','#114'));
});