import React, {Component} from 'react'
import {Tabs, Tab,Grid, Row, Col, Badge, ButtonToolbar, ButtonGroup, Button} from 'react-bootstrap'
import Slider from 'rc-slider'
import {OrderedSet} from 'immutable'
import SearchResultView from './SearchResultView'
import Checkbox from './Checkbox'
import API from '../api/Api'

import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import './SearchResult.css'

const createSliderWithTooltip = Slider.createSliderWithTooltip
const Range = createSliderWithTooltip(Slider.Range)

export default class SearchNavPills extends Component{
    constructor(props){
        super(props)
        let d = new Date()
        const pastYear = d.getFullYear() -1
        this.perPage = 10
        this.min = 0
        this.max = 40000
        this.state = {searchText:'', searchResult:'', pageOffset: 0, currentPage: 0, defaultSearchText:'+from+'+pastYear, min: this.min, max: this.max};
        this.handlePageOffsetBack = this.handlePageOffsetBack.bind(this)
        this.handlePageOffsetForward = this.handlePageOffsetForward.bind(this)
    }

    componentWillMount(){
        this.selectedPublisherCheckboxes = new Set();
        this.selectedFormatCheckboxes = new Set();
        this.dateRange = new OrderedSet();

        // console.log(this.props.match.params.searchText)
        if(this.props.match.params.searchText){
            this.setState({searchText: this.props.match.params.searchText})
        }else{
            this.setState({searchText: this.props.searchText})
        }
    }
    componentDidMount(){
        this.getData(this.state.searchText, 0, this.perPage)
    }

    updateSearchText = (text) =>{
        this.setState({searchText:text})
        this.getData(text, 0,10)
    }
    //Backward slide navigation buttons
    handlePageOffsetBack(){
        var temp = this.state.pageOffset - this.perPage*10
        this.setState({pageOffset: temp})
    }
    //Forward slide navigation buttons
    handlePageOffsetForward(){
        var temp = this.state.pageOffset + this.perPage*10
        this.setState({pageOffset: temp})
    }

    //Navigation buttion click and retrieve new data 
    handlePageNavClick (datasetIndex) {
        this.setState({currentPage:datasetIndex/this.perPage})
        this.getData(this.preparSearchText(), datasetIndex, this.perPage)
    }

    getData(query, start, limit){
        // console.log(query)
        fetch(API.baseUri + API.search  + query + '&start='+start + '&limit='+limit)
        .then((response) => {
            if (response.status === 200) {
                return response.json()
            } else console.log("Get data error ");
        })
        .then((json) => { 
            // console.log(json)
            this.setState({searchResult: json})
            // Calculate date range 
            const year = json.facets[1].options
            for(let key in year){
                this.dateRange = this.dateRange.add(year[key].lowerBound)
                this.dateRange = this.dateRange.add(year[key].upperBound)
            }
            this.setState({
                min: this.dateRange.min(), 
                max: this.dateRange.max()
            })
        }).catch((error) => {
          console.log('error on .catch', error);
        });
      }

    togglePublisherCheckbox = label => {
        if (this.selectedPublisherCheckboxes.has(label)) {
          this.selectedPublisherCheckboxes.delete(label);
        } else {
          this.selectedPublisherCheckboxes.add(label);
        }
        console.log(this.selectedPublisherCheckboxes)
      }
    toggleFormatCheckbox = label => {
        if (this.selectedFormatCheckboxes.has(label)) {
          this.selectedFormatCheckboxes.delete(label);
        } else {
          this.selectedFormatCheckboxes.add(label);
        }
        console.log(this.selectedFormatCheckboxes)
      }
    createPublisherCheckbox(label, hitCount) {
        return (
        <Checkbox
                label={label}
                handleCheckboxChange={this.togglePublisherCheckbox}
                key={label}
                hitCount = {hitCount}
            />
        )
    }
    createFormatCheckbox(label, hitCount) {
        return (
        <Checkbox
                label={label}
                handleCheckboxChange={this.toggleFormatCheckbox}
                key={label}
                hitCount = {hitCount}
            />
        )
    }
    filterButtonSubmit = () => {
        this.getData(this.preparSearchText(), 0, 10)
      }
    preparSearchText(){
        let byPublisher = ''
        let byFormat = ''
        let fromto = ''
        for (const checkbox of this.selectedPublisherCheckboxes) {
            byPublisher = byPublisher +  '+by+' +encodeURIComponent(checkbox)
        }
        for (const checkbox of this.selectedFormatCheckboxes) {
            byFormat = byFormat + '+as+' + encodeURIComponent(checkbox) + ' '
          }
        if(this.min!==0){
            fromto = fromto+"+from+"+this.min+"+to+"+this.max
        }
        return this.state.searchText + byPublisher + byFormat+fromto
    }

    onAfterChange = (value) => {
        // console.log(value)
        this.min = value[0]
        this.max = value[1]
    }
    render(){
        if (this.state.searchResult === '') return (<p></p>)

        return (
            <div className="paddomg-top">
                {/* <ButtonToolbar>
                    <ButtonGroup>
                        {this.state.pageOffset>0 ? <Button onClick={this.handlePageOffsetBack}> Back </Button> : <Button disabled> Back </Button>}
                        {Array(this.state.searchResult.hitCount).fill().map( (_, i) => { 
                            // Display two button for navigation by default
                            if( i>=this.state.pageOffset && i<=this.state.pageOffset+this.perPage*10 && i%this.perPage === 0) {
                                if( i/this.perPage === this.state.currentPage) return (<Button disabled key={i}>{i/this.perPage + 1}</Button>)
                                else return (<Button onClick={() => this.handlePageNavClick(i)} key={i}>{i/this.perPage +1}</Button>)
                            }else return ("")
                            })}
                            {this.state.pageOffset + this.perPage*10 < this.state.searchResult.hitCount ? <Button onClick={this.handlePageOffsetForward}> Forward </Button> : <Button disabled> Forward </Button>}
                    </ButtonGroup>
                </ButtonToolbar> */}
                <hr/>
                <nav aria-label="Page navigation">
                    <ul class="pagination">
                        {this.state.pageOffset>0 ? 
                            <li  onClick={this.handlePageOffsetBack}>
                                <a href="#"><span aria-hidden="true">&laquo;</span></a>
                            </li>
                            : 
                            <li className="disabled">
                                <a href="#" aria-label="Previous" >
                                <span aria-hidden="true">&laquo;</span>
                                </a>
                            </li>
                        }
                        {Array(this.state.searchResult.hitCount).fill().map( (_, i) => { 
                            // Display two button for navigation by default
                            if( i>=this.state.pageOffset && i<=this.state.pageOffset+this.perPage*10 && i%this.perPage === 0) {
                                if( i/this.perPage === this.state.currentPage) return (<li className="active" key={i}> <a href="#">{i/this.perPage + 1} </a></li>)
                                else return (<li onClick={() => this.handlePageNavClick(i)} key={i}> <a href="#">{i/this.perPage +1} </a></li>)
                            }else return ("")
                            })}
                        {this.state.pageOffset + this.perPage*10 < this.state.searchResult.hitCount ?
                            <li onClick={this.handlePageOffsetForward}>
                                <a href="#"><span aria-hidden="true">&raquo;</span></a>
                            </li>
                            :
                            <li className="disabled">
                            <a href="#"><span aria-hidden="true">&raquo;</span></a>
                            </li>
                        }
                    </ul>
                </nav>

                <i> { this.state.searchResult.hitCount } datasets found
                    {this.state.searchResult.query.dateFrom ? ' from date '+this.state.searchResult.query.dateFrom.substring(0,10) : '' }
                    { this.state.searchResult.query.dateTo ? ' from date '+this.state.searchResult.query.dateTo.substring(0,10) : '' }
                </i>
                <hr/>
                {console.log(this.state.searchResult)}
                <Grid>
                    <Row>
                        <Col md={8}>
                            <SearchResultView result={this.state.searchResult}/>
                        </Col>
                        <Col md={4}>
                            <div className="right-filter">
                                <Row>
                                <h4 className="col-xs-8">Top 10 {this.state.searchResult.facets[0].id} </h4>
                                <span  className="col-xs-4"><Button bsStyle="info pull-right" onClick={this.filterButtonSubmit}> Refine Result </Button></span>
                                </Row>
                                <hr />
                                <ul className="cust-list">
                                {this.state.searchResult.facets[0].options.map((value, key) => {
                                    return (<li className="checkbox"  key={key}> 
                                            {this.createPublisherCheckbox(value.value, value.hitCount)}
                                            </li>)
                                })}
                                </ul>
                                <br />

                                <h4>Top 10 {this.state.searchResult.facets[2].id}</h4>
                                <hr />
                                <ul className="cust-list">
                                {this.state.searchResult.facets[2].options.map((value, key) => {
                                    return (<li className="checkbox"  key={key}> 
                                                {this.createFormatCheckbox(value.value, value.hitCount)}
                                            </li>)
                                })}
                                </ul>
                                <br />

                                <h4>Date Range</h4>
                                <div className="slider">
                                <i>The Data Range is retrieved from datasets</i>
                                {/* <i>{this.min}</i>range<i className="pull-right">{this.max} </i> */}
                                    <Range step={1} 
                                        defaultValue={[this.min, this.max]} 
                                        min={this.state.min} 
                                        max={this.state.max}
                                        onAfterChange={this.onAfterChange}
                                        dots={false}
                                        tipFormatter={value => `${value}`}
                                        allowCross={false}  />
                                    <i>{this.state.min}</i><i className="pull-right">{this.state.max} </i>
                                </div>
                                <hr />
                                <Button bsStyle="info pull-right" onClick={this.filterButtonSubmit}> Refine Result </Button>
                            </div>
                        </Col>
                    </Row>
                
                </Grid>

            </div>
        )
    }
}
