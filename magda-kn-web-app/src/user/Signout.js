import React, {Component} from 'react'
import { Redirect } from "react-router-dom";

import API from '../config'
import './User.css'

export default class Signout extends Component {
    constructor(props){
        super(props)
        this.state = {logout: ''}
    }
    componentDidMount(){
        // Use gatway auth/logout api for logout since the magda-authorization-api did not provide a logout api
        fetch("/auth/logout", {credentials: "include"}).then(res =>{
            if (res.status === 200){
                return {'result': 'success'}
            }
        }).then(re => {
            if(re.result === 'success')
                this.setState({logout: 'success'})
        }).catch(error => console.log(error))
    }
    render(){
        if(this.state.logout==='success'){
            // window.location.reload(true)
            window.localStorage.clear()
            return (<Redirect to='/' />)
        }else{
            return (<p className="padding-top">Logout ...</p>)
        }
       
    }
      
}
