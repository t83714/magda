import React, {Component} from 'react'
import {Grid, Row, Col, Button} from 'react-bootstrap'
import {OrderedSet} from 'immutable'
import Slider from 'rc-slider'

import SearchResultView from '../search/SearchResultView'
import Checkbox from '../search/Checkbox'
import './DataSet.css'
import API from '../config'

import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';

const createSliderWithTooltip = Slider.createSliderWithTooltip
const Range = createSliderWithTooltip(Slider.Range)

export default class DataSetListForOrg extends Component {
    constructor(props){
        super(props)
        this.min = 0
        this.max = 40000
        this.state = {result:'', publisher:this.props.location.params ? this.props.location.params.org_name: '',min: this.min, max: this.max}
    }

    componentWillMount(){
        this.selectedFormatCheckboxes = new Set();
        this.dateRange = new OrderedSet();
    }
    componentDidMount(){
        // console.log(this.state.publisher)
        if(this.state.publisher === ''){
            this.getPublisherById(this.props.match.params.pub_id)
        }
        else
        this.getData(this.state.publisher)
    }

    getPublisherById(id){
        fetch(API.dataSetOrgInfo+id)
                .then((response) => {
                    if (response.status === 200) {
                        return response.json()
                    } else console.log("Get data error ");
                })
                .then((json) => {
                    console.log(json)
                    this.setState({publisher: json.name})
                    this.getData(json.name)
                }).catch((error) => {
                    console.log('error on .catch', error);
                });
    }

    getData(query){
        const preparedQuery = this.preparSearchText(query)
        // console.log(query)
        fetch( API.search + 'datasets?query=' + preparedQuery + '&start=0&limit=2000')
        .then((response) => {
            if (response.status === 200) {
                return response.json()
            } else console.log("Get data error ");
        })
        .then((json) => { 
            // console.log(json)
            this.setState({result: json})
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
        this.getData(this.state.publisher)
      }
    preparSearchText(publisher){
        let byPublisher = '*+by+'+encodeURIComponent(publisher)
        let byFormat = ''
        let fromto = ''
        for (const checkbox of this.selectedFormatCheckboxes) {
            byFormat = byFormat + '+as+' + encodeURIComponent(checkbox) + ' '
          }
        if(this.min!==0){
            fromto = fromto+"+from+"+this.min+"+to+"+this.max
        }
        return byPublisher + byFormat+fromto
    }

    onAfterChange = (value) => {
        // console.log(value)
        this.min = value[0]
        this.max = value[1]
    }


    render(){
        console.log(this.state.result)
        if(this.state.result!=='')
        return (
            <div className="padding-top">
            <Grid>
                <Row>
                    <h3>Dataset list for {this.state.publisher} </h3>
                    <br />
                    <i> {this.state.result.hitCount} datasets found
                    </i>
                    <hr />
                </Row>
                <Row>
                    <Col md={8}>
                        <SearchResultView result={this.state.result} />
                    </Col>
                    <Col md={4}>
                    <div className="right-filter">
                        <Row>
                            <h4 className="col-xs-8">Top 10 {this.state.result.facets[2].id} </h4>
                            <span  className="col-xs-4"><Button bsStyle="info" className="pull-right" onClick={this.filterButtonSubmit}> Refine Result </Button></span>
                        </Row>
                        <hr />
                        <ul className="cust-list">
                            {this.state.result.facets[2].options.map((value, key) => {
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
                        <Button bsStyle="info" className="pull-right" onClick={this.filterButtonSubmit}> Refine Result </Button>
                    </div>
                    </Col>
                </Row>
            
            </Grid>
            </div>
        )
        return(<div></div>)
    }
}