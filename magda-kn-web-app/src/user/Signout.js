import React, {Component} from 'react'
import { Nav, Navbar, NavItem, NavDropdown, MenuItem, Image } from 'react-bootstrap'
import { Redirect } from "react-router-dom";
import './User.css'

export default class Signout extends Component {
    constructor(props){
        super(props)
    }
    logout(){
        // Use gatway auth/logout api for logout since the magda-authorization-api did not provide a logout api
        fetch("/auth/logout", {credentials: "include"}).then(res =>{
            if (res.status === 200){
                this.props.resetUser()
                return(<Redirect to='/' />)
            }
        }).catch(error => console.log(error))
    }

    render(){
        return(
            <MenuItem onClick={() =>this.logout()}>
            Sign Out
            </MenuItem>
        )       
    }
}
