// npm init -y
// npm install minimist
// npm install path
// npm install excel4node
// npm install jsdom
// npm install axios
// npm install pdf-lib
// node main.js --url="https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results" --json=teams.json --excel=teams.xlsx --folder=WorldCup2019

let minimist = require("minimist");
let fs = require("fs");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let path = require("path");
let pdf = require("pdf-lib");
const workbook = require("excel4node/distribution/lib/workbook");

let args = minimist(process.argv);

let Promise_of_html = axios.get(args.url);   //step 1
Promise_of_html.then(function (response) {
    let html = response.data
    handleHTML(html);
});

function handleHTML(html)                   //step2
{
    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;
    let matches_blocks = document.querySelectorAll(".col-md-8.col-16");
    
    CreateJSO(matches_blocks);
}

function CreateJSO(matches_blocks)       // step3
{
    // Creating JSO and then convert into JSON.
    
    let matches =[];  // contains every match details and this is JSO

    //handing Every Matches using loop 
    for(let i=0;i<matches_blocks.length;i++)
    {
        let match_block = matches_blocks[i];
        let match={
            t1 : "",
            t2 : "",
            t1s : "",
            t2s : "",
            result : ""
        }

        // to get teamname
        let teamsname= match_block.querySelectorAll(".team .name-detail .name");
        match.t1 = teamsname[0].textContent;
        match.t2 = teamsname[1].textContent;

        let result_info = match_block.querySelector(".status-text")
        match.result = result_info.textContent;

        // for Score
        let Score_info = match_block.querySelectorAll(".score-detail .score")
        if(Score_info.length == 2)
        {
            match.t1s= Score_info[0].textContent;
            match.t2s= Score_info[1].textContent;
        }
        else if(Score_info.length ==1)
        {
            match.t1s = Score_info[0].textContent;
        }
        else{}

        matches.push(match);

    }
    ArrayManipulationAndCreateJSON(matches);
}

function ArrayManipulationAndCreateJSON(matches) //step 4 by array manipulation coveret JSO format of matches into suitable teams format and convert into json
{
    let  teams=[];

    for(let i=0;i<matches.length;i++)
    {
        putTeamInTeamsArrayIfMission(matches[i],teams);
        putMatchInAppopiateTeam(matches[i],teams);
    }

    // creating JSON

    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync(args.json,teamsJSON,"utf-8");

    // Create excel from JSON
    CreateExcel(teamsJSON);

    // Create pdf and folder from JSON
   CreatePDF(teamsJSON);    

    
    
}

function putTeamInTeamsArrayIfMission(match,teams) //step 4.1
{
    let  Team1NotPresent = true;
    for(let i=0;i<teams.length;i++)
    {
        if(teams[i].name==match.t1)
        {
            Team1NotPresent = false;
            break;
        }
    }
    if(Team1NotPresent)
    {
        let team ={
            name:match.t1,
            matches: []
        }

        teams.push(team);
    }

    let  Team2NotPresent = true;
    for(let i=0;i<teams.length;i++)
    {
        if(teams[i].name==match.t2)
        {
            Team2NotPresent = false;
            break;
        }
    }
    if(Team2NotPresent)
    {
        let team ={
            name:match.t2,
            matches: []
        }

        teams.push(team);
    }

}

function putMatchInAppopiateTeam(match,teams)
{
    let Teams1Match = -1;
    for(let i=0;i<teams.length;i++)
    {
        if(match.t1==teams[i].name)
        {
            Teams1Match = i;
            break;
        }
    }

    let match1 = {
        opponent_name:match.t2,
        self_score:match.t1s,
        opponent_score:match.t2s,
        result:match.result
    }
    teams[Teams1Match].matches.push(match1);

    let Teams2Match = -1;
    for(let i=0;i<teams.length;i++)
    {
        if(match.t2==teams[i].name)
        {
            Teams2Match = i;
            break;
        }
    }

    let match2 = {
        opponent_name:match.t1,
        self_score:match.t2s,
        opponent_score:match.t1s,
        result:match.result
    }
    teams[Teams2Match].matches.push(match2);
}

function CreateExcel(teamsJSON)
{
    let teams = JSON.parse(teamsJSON);

    let wb = new excel.Workbook();

    for(let i=0;i<teams.length;i++)
    {
        let ws = wb.addWorksheet(teams[i].name);

        ws.cell(1,1).string("Opp Team");
        ws.cell(1,2).string("Opp Score");
        ws.cell(1,3).string("Home Score");
        ws.cell(1,4).string("Result");

        for(let j=0;j<teams[i].matches.length;j++)
        {
            ws.cell(j+2,1).string(teams[i].matches[j].opponent_name);
            ws.cell(j+2,2).string(teams[i].matches[j].opponent_score);
            ws.cell(j+2,3).string(teams[i].matches[j].self_score);
            ws.cell(j+2,4).string(teams[i].matches[j].result);
        }
    }

    wb.write(args.excel);
}

function CreatePDF(teamsJSON)
{
    let teams = JSON.parse(teamsJSON);

    fs.mkdirSync(args.folder);

    for(let i=0;i<teams.length;i++)
    {
        let teamsfolder = path.join(args.folder,teams[i].name);
        fs.mkdirSync(teamsfolder);

        for(let j=0;j<teams[i].matches.length;j++)
        {
            let matchfilename = path.join(teamsfolder,teams[i].matches[j].opponent_name +".pdf");
            CreateScoreCard(teams[i].name,teams[i].matches[j],matchfilename); 
        }
    }

}

function CreateScoreCard(teamname , match , matchFilename){

    // modify template.pdf using pdf-lib file

    let t1 = teamname;
    let t2 = match.opponent_name;
    let t1s = match.self_score;
    let t2s = match.opponent_score;
    let result = match.result;

    let originalBytes = fs.readFileSync("Template.pdf");
    let pdfDocPrms = pdf.PDFDocument.load(originalBytes);
    pdfDocPrms.then(function (pdfDoc) {
        let page = pdfDoc.getPage(0);
        page.drawText(t1, {
            x: 430,
            y: 290,
            size: 16
        });
        page.drawText(t2, {
            x: 430,
            y: 253,
            size: 16
        });
        page.drawText(t1s, {
            x: 430,
            y: 218,
            size: 16
        });
        page.drawText(t2s, {
            x: 430,
            y: 183,
            size: 16
        });
        page.drawText(result, {
            x: 430,
            y: 110,
            size: 13
        });

        let pdfSavePrms = pdfDoc.save();
        pdfSavePrms.then(function (newBytes) {
            if (fs.existsSync(matchFilename + ".pdf") == true) {
                fs.writeFileSync(matchFilename + "(1).pdf", newBytes);
            } else {
                fs.writeFileSync(matchFilename + ".pdf", newBytes);
            }
        })
    })

}