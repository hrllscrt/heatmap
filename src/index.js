/**
 * This is the main vue component for the graph.
 */

import Vue from 'vue'
import VueResource from 'vue-resource'

import {groupHarvestDatesByYearAndMonth} from './transformer';
import {calculateLinearActivityLevel, calculateLogarithmicActivityLevel} from './transformers/plugins/transformation-functions'
import VTooltip from 'v-tooltip'

import format from 'date-fns/format'

Vue.use(VueResource);
Vue.use(VTooltip);

/**
 * Transform a Javascript Date to a human readable string.
 * 
 * @param {Date} date 
 */
function toHumanDate(date, showWeekday = false) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (date instanceof Date) {
        let dateString = `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`

        return showWeekday ? days[date.getDay()] + ', ' + dateString : dateString;
    }
    
    return date;
}

Vue.filter('human-date', function (value) {
    return toHumanDate(value);
});

Vue.filter('human-date-and-time', function (date) {
    if (date instanceof Date) {
        return toHumanDate(date) + ` ${date.getHours() < 10 ? '0' + date.getHours() : date.getHours()}:${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()}`;
    }

    return date;
});

Vue.filter('formatted-number', function (value) {
    if (!isNaN(value)) {
        return value.toLocaleString();
    }

    return value;
});

Vue.component('harvest-title', {
    props: ['title'],
    template: `<h1>{{ title }}</h1>`
});

Vue.component('harvest-date', {
    data: () => {
        return {
            harvestData: null,
            view: 'year-month',
            year: null,
            noResults: false
        }
    },
    template: `
        <div>
            <div v-if="harvestData" class="tableContainer">
            
                <table class="totalHarvestData">
                    <tbody>
                        <tr>
                            <td>First harvest:</td>
                            <td>{{ harvestData.fromDate | human-date }}</td>
                        </tr>
                        <tr>
                            <td>Latest harvest:</td>
                            <td>{{ harvestData.toDate | human-date }}</td>
                        </tr>
                        <tr>
                            <td>Total harvests:</td>
                            <td>{{ harvestData.numberOfHarvests | formatted-number }}</td>
                        </tr>
                    </tbody>
                </table>
                <br>
                <p class="detailsMenu">
                    Show: 
                    <span class="pointer" :class="{active: this.view === 'year-month'}" @click="showYearMonth">Months</span> - 
                    <span class="pointer" :class="{active: this.view === 'all-years'}" @click="showAllYears">Days</span>
                </p>
                <transition name="fadeIn">
                    <year-month-graph v-if="view === 'year-month'" :harvest-data="harvestData" :show-year-details="showYearWeek"></year-month-graph>
                </transition>        
                <transition name="fadeIn">
                    <week-graph v-if="view === 'year-week'" :year="year" :harvest-data="harvestData" :show-all="showYearMonth" class="detailsContainer"></week-graph>
                </transition> 
                <transition name="fadeIn">
                    <all-years-graph v-if="view === 'all-years'" :harvest-data="harvestData" class="detailsContainer"></all-years-graph>
                </transition> 
            </div>
            <div v-if="!harvestData && noResults === true">
                <p>No results.</p>
            </div>            
            <div v-if="!harvestData && noResults === false">
                <div id="spinner">
                    <p class="spinnerText">Fetching harvests</p>
                </div>
                <div id="overlay"></div>
            </div>
        </div>
    `,
    created() {
        this.$http.get(window.heatmap.dataUrl)
        .then(response => {
            if (response.data.dates === undefined || response.data.dates.length === 0) {
                this.noResults = true;
            }

            this.harvestData = groupHarvestDatesByYearAndMonth(response.data.dates, calculateLinearActivityLevel);
        });
    },
    methods: {
        showYearWeek(year) {
            this.year = year;
            this.view = 'year-week';
        },
        showYearMonth() {
            this.year = null;
            this.view = 'year-month';
        },
        showAllYears() {
            this.year = null;
            this.view = 'all-years';
        }
    }
});


Vue.component('year-month-graph', {
    props: ['harvestData', 'showYearDetails'],    // showWeeks is a callback function.
    template: `
        <div class="yearTables">
            <table class="monthLabels">
                <tr><td class="empty">&nbsp;</td></tr>
                <tr><td>January</td></tr>
                <tr><td>February</td></tr>
                <tr><td>March</td></tr>
                <tr><td>April</td></tr>
                <tr><td>May</td></tr>
                <tr><td>June</td></tr>
                <tr><td>July</td></tr>
                <tr><td>August</td></tr>
                <tr><td>September</td></tr>
                <tr><td>October</td></tr>
                <tr><td>November</td></tr>
                <tr><td>December</td></tr>
            </table>
            <table v-for="(yearData, year) in harvestData.dates">
                <thead>
                    <tr>
                        <th>{{ year }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(data, month) in yearData.months">
                        <td v-on:click="showYearDetails(year)" v-tooltip.top-center="formatHarvestDate(data)" v-bind:class="mapActivityLevel(data)">&nbsp;</td>
                    </tr>
                </tbody>
            </table>
            <color-legend></color-legend>            
        </div>                 
    `,
    methods: {
        formatHarvestDate(data) {
            return 'Harvests: ' + data.numberOfHarvests.toLocaleString();
        },
        mapActivityLevel(data) {
            return {
                activityLevel4: data.activityLevel === 4, 
                activityLevel3: data.activityLevel === 3, 
                activityLevel2: data.activityLevel === 2, 
                activityLevel1: data.activityLevel === 1
            };
        }
    }
})


Vue.component('week-graph', {
    props: ['harvestData', 'year', 'showAll'],
    data: function() {
        return {
            harvestsForDay: null,
            showDate: null
        }
    },
    template: `
    <div id="details">
        <p class="yearHeader">{{ year }} - <span v-on:click="showAll()" class="hideDetails">Hide details</span></p>
        <table v-for="(week, weekNumber) in harvestData.dates[year]['weeks']">
            <tbody>
                <tr v-for="(data, dayNumber) in week">
                    <td v-if="data !== null" @click="harvestsForDay = data.harvests; showDate = data.date;" class="weekday" v-tooltip.top-center="formatHarvestDate(data)" v-bind:class="mapActivityLevel(data)"></td>
                    <td v-if="data === null" class="weekday filler"><!-- non-existing day --></td>
                </tr>
            </tbody>
        </table>
        <color-legend></color-legend>        
        <harvests-for-day v-if="harvestsForDay !== null" :harvests="harvestsForDay" :date="showDate"></harvests-for-day>
    </div>
    `,
    methods: {
        formatHarvestDate(data) {
            return toHumanDate(data.date, true) + '<br>' +
                'Harvests: ' + data.numberOfHarvests.toLocaleString()
        },
        mapActivityLevel(data) {
            return {
                activityLevel4: data.activityLevel === 4, 
                activityLevel3: data.activityLevel === 3, 
                activityLevel2: data.activityLevel === 2, 
                activityLevel1: data.activityLevel === 1
            };
        }
    }
});


Vue.component('all-years-graph', {
    props: ['harvestData', 'showAll'],
    template: `
    <div id="details">  
        <div v-for="(_, year) in harvestData.dates">
            <p class="yearHeader">{{ year }}</p>
            <table v-for="(week, weekNumber) in harvestData.dates[year]['weeks']">
                <tbody>
                    <tr v-for="(data, dayNumber) in week">
                        <td v-if="data !== null" class="weekday" v-tooltip.top-center="formatHarvestDate(data)" v-bind:class="mapActivityLevel(data)"></td>
                        <td v-if="data === null" class="weekday filler"><!-- non-existing day --></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    `,
    methods: {
        formatHarvestDate(data) {
            return toHumanDate(data.date, true) + '<br>' +
                'Harvests: ' + data.numberOfHarvests.toLocaleString()
        },
        mapActivityLevel(data) {
            return {
                activityLevel4: data.activityLevel === 4, 
                activityLevel3: data.activityLevel === 3, 
                activityLevel2: data.activityLevel === 2, 
                activityLevel1: data.activityLevel === 1
            };
        }
    }
});

/**
 * Harvests for a particular day
 */
Vue.component('harvests-for-day', {
    props: ['harvests', 'date'],
    template: `
        <div id="harvests-for-day">
            <h3>Harvests for {{ date | human-date }}</h3>
            <ol>
                <li v-for="harvest in harvests"><a :href="generateLink(harvest)" target="_blank">{{ harvest | human-date-and-time }}</a></li>
            </ol>
        </div>
    `,
    methods: {
        generateLink(harvest) {
            if (window.heatmap.generateLink)
                return window.heatmap.generateLink(harvest);
        }
    }
});


Vue.component('color-legend', {
    template: `
        <div id="legends">
            Less <div class="legend legend0"></div>
            <div class="legend legend1"></div>
            <div class="legend legend2"></div>
            <div class="legend legend3"></div>
            <div class="legend legend4"></div> More
        </div>
    `
});

let app = new Vue({
    el: "#app",
    data: {
        title: window.heatmap.title ? window.heatmap.title : "Heatmap"
    },
    template: `
        <div>
            <harvest-title :title="title"></harvest-title>
            <harvest-date></harvest-date>
        </div>
    `
});
