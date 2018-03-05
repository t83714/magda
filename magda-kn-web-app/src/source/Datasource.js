
import React, {Component} from 'react'
import {Grid, Row, ButtonToolbar} from 'react-bootstrap'
import {Link} from 'react-router-dom'

import API from '../api/Api'
import'./Datasource.css'

export default class Datasource extends Component {
    constructor(props){
        super(props)
        this.state = {datasource: new Map()}
    }
    componentDidMount(){
        if(this.state.datasource.size===0)
        this.getDataSource()
    }
    
    getDataSource(){
        console.log('load data ... ')
        fetch(API.baseUri + API.dataSource)
        .then((response) => {
            // console.log(response)
            if (response.status === 200) {
                return response.json()
            } else console.log("Get data error ");
        })
        .then((json) => {
            this.organizeDataSource(json)
        }).catch((error) => {
          console.log('error on .catch', error);
        });
    }
    
    organizeDataSource(data){
        //Source map id as key, souce object as value
        let sourceMap = new Map()
        let sourcePublisherMap = new Map()
        data.records.map((record) => {
            if(!sourceMap.has(record.aspects.source.id)) sourceMap.set(record.aspects.source.id, record.aspects.source)
            let publisherArray = sourcePublisherMap.get(record.aspects.source.id) || []
            publisherArray.push(record)
            sourcePublisherMap.set(record.aspects.source.id,publisherArray )
            return null
        })
        this.setState({datasource: sourceMap, sourcePublisherMap: sourcePublisherMap})
    }

    render(){
        if(this.state.datasource === undefined)  return (<p></p>)
        const keys = [...this.state.datasource.keys()]
        const datasourceView = []
        for(const key in keys){
            const datasourceObject = this.state.datasource.get(keys[key])
            const datasourceName = datasourceObject.name
            console.log(datasourceName)
            datasourceView.push(
                <div className="col-xs-3" key={key}>
                <div className="thumbnail"  >
                    <img className="" src={'/img/'+keys[key]+'.png' } alt="logo" />
                    <div className="caption">
                        <h4 className="org-name">{datasourceName}</h4>
                        <p className="card-text"><a href={datasourceObject.url}>{datasourceObject.url.substr(0,30) }...</a></p>
                        {/* <ButtonToolbar>
                        <Button onClick={() => this.setDisplayView(datasourceName)} className="btn btn-default pull-right">View {this.state.sourcePublisherMap.get(datasourceName).length} organization</Button>
                        </ButtonToolbar> */}
                        <ButtonToolbar>
                        <Link to={{ pathname:`/datasource/${keys[key]}`, params:{sourcePublisherMap: this.state.sourcePublisherMap, datasource:this.state.datasource}}} className="btn btn-default btn-info pull-right"> Visit {this.state.sourcePublisherMap.get(keys[key]).length} Publishers</Link>
                        </ButtonToolbar>
                    </div>
                </div>
                </div>
            )
        }
        return(
            <Grid bsClass="padding-top">
                <Row>
                    <h2>Data Sources</h2>
                    <hr />
                </Row>
                <Row>
                    {datasourceView}
                </Row>
            </Grid>
        )
    }
}