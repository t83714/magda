import React, {Component} from 'react'
import {Grid, Row, Col} from 'react-bootstrap'
import {Link } from 'react-router-dom'

import API from '../api/Api'
import './DataSet.css'

export default class AboutOrganization extends Component {
    constructor(props){
        super(props)
        this.state = {pub_id: '', name: '', datasetNum: 0}
      }
    
    componentWillMount(props){
        this.setState({pub_id: this.props.match.params.pub_id})
    }
    componentDidMount(){
        this.getData()
    }
    getData(){
        if(this.state.pub_id !== '')
            fetch(API.baseUri + API.dataSetOrgInfo + this.state.pub_id + '?aspect=organization-details&optionalAspect=source')
            .then((response) => {
                if (response.status === 200) {
                    return response.json()
                } else console.log("Get data error ");
            })
            .then((json) => {
                this.setState({aspects: json.aspects, name: json.name})
                this.getDatasetCountByPublisher(json.name)
            }).catch((error) => {
                console.log('error on .catch', error);
            });
    }
    getDatasetCountByPublisher(publisher){
        fetch(API.baseUri + API.search + '*+by+' + publisher + '&start=0&limit=0')
                .then((response) => {
                    if (response.status === 200) {
                        return response.json()
                    } else console.log("Get data error ");
                })
                .then((json) => {
                    this.setState({datasetNum: json.hitCount})
                }).catch((error) => {
                    console.log('error on .catch', error);
                });
    }


    render(){
        return (
            <Grid bsClass="padding-top">
            <Row>
                <h2>About {this.state.name}</h2>
                <hr />
            </Row>
            <Row>
                <Col xs={3}>
                    <img className="col-xs-12 img" src={this.state.aspects? this.state.aspects['organization-details'].imageUrl? this.state.aspects['organization-details'].imageUrl : '../img/emptyImg.png':''} alt="No logo avilable"/>
                </Col>
                <Col xs={8}>
                    <ul className="list-group">
                        <li className="list-group-item">ID: <code> {this.state.pub_id} </code></li>
                        <li className="list-group-item">dataset: <Link to={{ pathname:`/dataset/${this.state.pub_id}`, params:{org_name: this.state.name}}}> View all {this.state.datasetNum} datasets</Link>  </li>
                        <li className="list-group-item">Source
                            <pre>
                            <ul>
                                <li>Name: {this.state.aspects? this.state.aspects.source.name: ''} </li>
                                <li>type: {this.state.aspects? this.state.aspects.source.type: ''}</li>
                                <li>URL: <a href={this.state.aspects? this.state.aspects.source.url: ''}> {this.state.aspects? this.state.aspects.source.url: ''} </a></li>
                            </ul>
                            </pre>
                        </li>
                        <li className="list-group-item">Description
                            <pre>{this.state.aspects? this.state.aspects["organization-details"].description: ''}</pre>
                        </li>
                        
                    </ul>
                </Col>
            </Row>

        </Grid>
        )
    }
}