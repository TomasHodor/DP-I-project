import React from 'react';
import {Button, Form, Container, Alert} from "react-bootstrap"
import bcrypt from "bcryptjs";

class Registration extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            email: '',
            password: '',
            password2: '',
            name: '',
            surname: '',
            phone: '',
            formError: '',
            error: {}
        };
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    async handleSubmit(event) {
        event.preventDefault();

        if (this.state.password !== this.state.password2) {
            this.setState({formError: "Passwords are not same", error: {'password': true}});
            return;
        }
        if (this.state.email === '') {
            this.setState({formError: "Email is empty", error: {'email': true}});
            return;
        }
        const hashedPassword = await bcrypt.hash(this.state.password, 10)
        fetch('http://127.0.0.1:5000/user', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: this.state.name,
                surname: this.state.surname,
                email: this.state.email,
                password: hashedPassword,
                phone: this.state.phone
            })
        })
            .then(response => response.json().then(data => {
                this.setState({user_id: data.user_id, email: '', password: '', password2: '', error: {}, formError:''});
                this.props.handleLogin({"userId": data.user_id, "email": this.state.email});
            }))
    }

    render() {
        return (
            <Container id="main-container" className="d-grid h-100">
                <Form id="sign-in-form" className="text-center p-3 w-100" onSubmit={this.handleSubmit}>
                    <Form.Group className="mb-3" controlId="formBasicEmail">
                        <Form.Control
                            type="email"
                            placeholder="Enter email"
                            value={this.state.email}
                            onChange={(e) =>  this.setState({email: e.target.value})}
                            isInvalid={ !!this.state.error.email }
                        />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicName">
                        <Form.Control
                            type="text"
                            placeholder="Enter Name"
                            value={this.state.name}
                            onChange={(e) =>  this.setState({name: e.target.value})}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicSurname">
                        <Form.Control
                            type="text"
                            placeholder="Enter Surname"
                            value={this.state.surname}
                            onChange={(e) =>  this.setState({surname: e.target.value})}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicPhone">
                        <Form.Control
                            type="text"
                            placeholder="Enter Phone"
                            value={this.state.phone}
                            onChange={(e) =>  this.setState({phone: e.target.value})}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicPassword">
                        <Form.Control
                            type="password"
                            placeholder="Enter password"
                            value={this.state.password}
                            onChange={(e) =>  this.setState({password: e.target.value})}
                            isInvalid={ !!this.state.error.password }
                        />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="formBasicPassword2">
                        <Form.Control
                            type="password"
                            placeholder="Retype password"
                            value={this.state.password2}
                            onChange={(e) =>  this.setState({password2: e.target.value})}/>
                    </Form.Group>
                    <Form.Group className="d-flex justify-content-center mb-4" controlId="creator">
                        <Form.Check label="Creator" />
                    </Form.Group>
                    <div className="d-grid">
                        <Button variant="dark" type="submit">
                            Register
                        </Button>
                    </div>
                    <br/>
                    {this.state.formError ?
                        <Alert variant='danger'>
                            {this.state.formError}
                        </Alert> : null}
                </Form>
            </Container>
        );
    }
}
export default Registration;