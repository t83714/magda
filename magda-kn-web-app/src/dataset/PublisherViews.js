import React, {Component} from 'react'
import { Row, ButtonToolbar, Well, InputGroup, FormControl, DropdownButton, MenuItem} from 'react-bootstrap'
import { Link } from 'react-router-dom'
import Pagination from './Pagination'

import './DataSet.css'

export default class PublisherViews extends Component {
    constructor(props){
        super(props)
        this.state = { totalCount: 0, 
            viewType:'line', 
            publisherMap:new Map(), 
            datasetInfo:[],
            currentPage: 0,
            perPage:20, 
        }
        //view type: line, grid
        this.searchTextChange = this.searchTextChange.bind(this)
        this.dropDownItemChange = this.dropDownItemChange.bind(this)
        this.allPublisher = []
      }

    setView(view){
        this.setState({viewType:view})
    }
    updateCurrentPage = (page) =>{
        this.setState({currentPage: page})
    }

    searchTextChange (e) {
        this.setState({searchText: e.target.value})
        let newDatasetInfo = []
        for(let ele in this.allPublisher){
            if (JSON.stringify(this.allPublisher[ele]).toLowerCase().indexOf(e.target.value.trim().toLowerCase())===-1){
                newDatasetInfo.push(this.allPublisher[ele])
            }
        }
        this.setState({datasetInfo: newDatasetInfo})
    }

    dropDownItemChange (e) {
        if(e==='All'){
            this.allPublisher = []
            const datasourceKeys = [...this.props.datasource.keys()]
            for(let key in datasourceKeys){
                this.allPublisher = this.allPublisher.concat(this.props.publisherMap.get(datasourceKeys[key]))
            }
            this.setState({dropdownTitle: 'All Datasources', currentPage: 0})
        }else{
            this.allPublisher = this.props.publisherMap.get(e)
            // console.log(this.props.datasource.get(e))
            this.setState({dropdownTitle: this.props.datasource.get(e).name +' ('+this.allPublisher.length+')', currentPage:0})
        }   
    }


    parentPropsUpdate(){
        const size = this.props.publisherMap!==undefined ? this.props.publisherMap.size:-1
        if(this.state.publisherMap.size !==  size && size!== -1){
            this.setState({publisherMap: this.props.publisherMap})
            this.setState({dropdownTitle: this.props.datasource.get(this.props.default)? this.props.datasource.get(this.props.default).name: 'All Datasources'})
            this.allPublisher = []
            const datasourceKeys = [...this.props.datasource.keys()]
            // console.log(this.props.default==='All')
            if(this.props.default==='All'){
                for(let key in datasourceKeys){
                    // console.log(this.props.publisherMap.get(datasourceKeys[key]))
                    this.allPublisher = this.allPublisher.concat(this.props.publisherMap.get(datasourceKeys[key]))
                }
            }else{
                this.allPublisher = this.allPublisher.concat(this.props.publisherMap.get(this.props.default))
            }
        }
    }

    render(){
        // console.log(this.props.publisherMap)
        if(this.props.publisherMap === undefined)  return ('')
        else this.parentPropsUpdate()

        const datasourceKeys = [...this.props.datasource.keys()]

        let display = this.allPublisher.filter(x => !this.state.datasetInfo.includes(x))
        // console.log(display.slice(this.state.currentPage*this.perPage, 10))
        const lineView = display.filter((value, index) => index >=this.state.currentPage*this.state.perPage && index < this.state.currentPage*this.state.perPage+this.state.perPage).map((value, key) => {
            return (
                <div className="media" key={key}  >
                    {/* <div className="media-left">
                        <img className="small-img" src={value.aspects['organization-details'].imageUrl ? value.aspects['organization-details'].imageUrl: '/img/emptyImg.png' } alt="logo" />
                    </div> */}
                    <div className="media-body">
                        <Link to={'/organisation/'+value.id}><h3 className="media-heading org-name">{value.name}</h3></Link>
                        <p className="card-text">{value.aspects['organization-details'].description}</p>
                        <ButtonToolbar> 
                            <Link to={'/dataset/'+value.id} className="btn alert-info pull-right">View Dataset</Link> &nbsp;  &nbsp;
                            <Link to={'/organisation/'+value.id} className="btn alert-info pull-right">About</Link>
                        </ButtonToolbar>
                    </div>
                </div>
            )
        });
        const gridView = display.filter((value, index) => index >=this.state.currentPage*this.state.perPage && index < this.state.currentPage*this.state.perPage+10).map((value, key) => {
            return (
                <div className="col-xs-3" key={key}>
                    <div className="thumbnail"  >
                        {/* <img className="" src={value.aspects['organization-details'].imageUrl ? value.aspects['organization-details'].imageUrl: '/img/emptyImg.png' } alt="logo" /> */}
                        <div className="caption">
                        <Link to={'/organisation/'+value.id}><h4 className="org-name">{value.name}</h4></Link>
                            {/* <p className="card-text">{value.aspects['organization-details'].description}</p> */}
                            <ButtonToolbar> 
                                <Link to={'/dataset/'+value.id} className="btn alert-info pull-right">View Dataset</Link> &nbsp;  &nbsp;
                                <Link to={'/organisation/'+value.id} className="btn alert-info pull-right">About</Link>
                            </ButtonToolbar>
                        </div>
                    </div>
                </div>
            )
        });
        return (
            <div>
                <Well bsSize="small">
                    <strong> Views </strong>
                    <div className="btn-group">
                        <button type="button" onClick={ () => this.setView('line')} className="btn btn-sm btn-custome"><span className="glyphicon glyphicon-th-list"></span>List</button>
                        <button type="button" onClick={ () => this.setView('grid')} className="btn btn-sm  btn-custome"><span className="glyphicon glyphicon-th"></span>Grid</button>
                    </div>
                    <div className="btn-group pull-right col-xs-4" >
                        <InputGroup>
                        <InputGroup.Addon>Filter</InputGroup.Addon>
                        <FormControl type="text" onChange={ this.searchTextChange } />
                        <InputGroup.Addon>{this.allPublisher.length - this.state.datasetInfo.length}</InputGroup.Addon>
                        </InputGroup>
                    
                    </div>
                </Well>
                <Row>
                    <i> Find total {this.allPublisher.length} publishers in {this.props.default==='All'? this.props.datasource.size + ' datasources' : ' datasource'}  &nbsp;
                        <DropdownButton
                        bsSize="xsmall"
                        title={this.state.dropdownTitle?this.state.dropdownTitle:' All Datasources'}
                        id="dropdown-size-extra-small"
                        >
                        {this.state.dropdownTitle==='All Datasources'? <MenuItem  eventKey={'All'} active onSelect={this.dropDownItemChange} >All Datasources</MenuItem>  : <MenuItem  eventKey={'All'} onSelect={this.dropDownItemChange} >All Datasources</MenuItem> }
                        
                        <MenuItem divider />
                        {datasourceKeys.map((value, key)=>{
                            if(value===this.props.default) return (<MenuItem eventKey={value} active key={key+1} onSelect={this.dropDownItemChange} >{this.props.datasource.get(value).name +' ('+this.props.publisherMap.get(value).length+')'}</MenuItem>)
                            else return (<MenuItem eventKey={value} key={key+1} onSelect={this.dropDownItemChange}>{this.props.datasource.get(value).name +' ('+this.props.publisherMap.get(value).length+')'}</MenuItem>)
                        })}
                        </DropdownButton>
                
                    
                    </i>
                    <hr />
                </Row>
                <Row>
                    {this.state.viewType==='line'? lineView : gridView}
                    <Pagination 
                        perPage={this.state.perPage} 
                        total={display.length} 
                        updateCurrentPage={this.updateCurrentPage} />
                    <br />
                    <br />
                </Row>
            </div>
        )
    }
}