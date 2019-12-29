import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
} from "react-router-dom";

import Button from "react-bootstrap/Button"

import Client from './client';

import Home from './components/Home/Home.jsx'
import Checkout from './components/Checkout/Checkout.jsx';
import CollectPayment from './components/CollectPayment/CollectPayment.jsx';
import EventSelector from './components/EventSelector/EventSelector';
import Success from './components/Success/Success.jsx';
import RegisterReader from './components/RegisterReader/RegisterReader.jsx'
import ErrorMessage from './components/ErrorMessage/ErrorMessage.jsx';
import Loader from './components/Loader/Loader.jsx'
import AskCustomer from "./components/AskCustomer/AskCustomer.jsx"


import Products from './static/Products';
import BackendUrl from './static/BackendUrl';
import ErrorSnippets from './static/ErrorSnippets'

import 'bootstrap/dist/css/bootstrap.min.css';


class Test extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      chargeAmount: 0,
      taxAmount: 0,
      currency: 0,
      workFlowInProgress: 0,
      event: "",
      errorOccured: false,
      errorMsg: "",
      cart: Products,
      readerRegistered: false
    }

    this.client = new Client(BackendUrl)
    this.terminal = this.client.initTerminal()
  }
}

const App = ({ client, terminal }) => {

  const [chargeAmount, setChargeAmount] = useState(0)
  const [taxAmount] = useState(0)
  const [currency] = useState('usd')
  const [workFlowInProgress, setWorkFlowInProgress] = useState(false)
  const [event, setEvent] = useState("")
  const [errorOccured, setErrorOccured] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [cart, setCart] = useState(Products)
  const [readerRegistered, setReaderRegistered] = useState(false)

  const setFriendlyErrorMessage = (errorMsg) => {
    ErrorSnippets.forEach((errorSnippet) => {
      if (errorMsg.includes(errorSnippet)) {
        return setErrorMsg(errorSnippet)
      }
      return setErrorMsg(errorMsg)
    })
  }

  const runWorkflow = async (workflowFn, args) => {
    let catchOccured = false
    setWorkFlowInProgress(true)
    setErrorOccured(true)
    setErrorMsg(null)
    try {
      await workflowFn(args);
    } catch (error) {
      catchOccured = true
      setFriendlyErrorMessage(`${error}`)
    } finally {
      setWorkFlowInProgress(false)
      setErrorOccured(catchOccured)
    }
  };

  ////////////////////////////////////
  // RegisterReader Component Funcs //
  ////////////////////////////////////

  const registerAndConnectReader = async (registrationCode) => {
    const reader = await client.registerReader({ registrationCode });
    await terminal.connectReader(reader);
  };

  /*
  Loading Screen While Registering and Connecting to Reader
  **/
  const registerAndConnectReaderWorkFlow = async (registrationCode) => {
    runWorkflow(registerAndConnectReader, registrationCode)
  }

  //////////////////////////////
  // Checkout Component Funcs //
  //////////////////////////////

  const collectLineItems = () => {
    let lineItems = []
    cart.forEach((item) => {
      if (item.quantity > 0) {
        let displayItem = {
          "description": item.label,
          "amount": item.price * 100,
          "quantity": item.quantity
        }
        lineItems.push(displayItem)
      }
    })
    return lineItems
  }

  /*
  Create Hash that the Reader will consume
  **/
  const createReaderDisplay = () => {
    const lineItems = collectLineItems()
    const readerDisplay = {
      type: 'cart',
      cart: {
        line_items: lineItems,
        tax: taxAmount,
        total: chargeAmount * 100 + taxAmount,
        currency: currency,
      },
    }
    return readerDisplay
  }

  /*
  Display Items Costomer Checked out on Reader
  **/
  const setReaderDisplay = async () => {
    const readerDisplay = createReaderDisplay()
    await terminal.setReaderDisplay(readerDisplay);
  };

  /*
  Loading Screen while setReaderDisplay is running
  **/
  const setReaderDisplayWorkFlow = async () => { runWorkflow(setReaderDisplay); };

  ////////////////////////////////////
  // CollectPayment Component Funcs //
  ////////////////////////////////////

  const createPaymentIntentDescription = () => {

    let lineItemsStr = ""
    cart.forEach((lineItem) => { lineItemsStr += `${lineItem.description} (${lineItem.quantity}), ` })
    const description = `${event.title} - ${lineItemsStr}`

    return description
  }

  const createPaymentIntent = () => {
    const description = createPaymentIntentDescription()
    const amount = chargeAmount * 100 + taxAmount
    const paymentIntent = { amount, currency, description }
    return paymentIntent
  }

  const collectPayment = async () => {
    const paymentIntent = createPaymentIntent()
    const processedPaymentIntent = await client.processPaymentIntent(paymentIntent);
    const payment = await terminal.collectPaymentMethod(processedPaymentIntent.secret);
    const processedPayment = await terminal.processPayment(payment.paymentIntent);
    const captureResult = await client.capturePaymentIntent({ paymentIntentId: processedPayment.paymentIntent.id });
    return captureResult;
  };

  const collectPaymentWorkFlow = async () => { runWorkflow(collectPayment) }

  const cancelPayment = async () => {
    await terminal.cancelCollectPaymentMethod();
  };

  const cancelPaymentWorkFlow = async () => { runWorkflow(cancelPayment) }

  const emptyCart = () => {
    const newCart = cart
    newCart.forEach((item) => item.quantity = 0)
    setCart(newCart)
    setChargeAmount(0)
  }

  return (
    <div className="app">
      {
        !readerRegistered ? <Redirect to="/" /> : null
      }
      <Loader
        loading={workFlowInProgress}
      />
      <ErrorMessage
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
        errorOccured={errorOccured}
        setErrorOccured={setErrorOccured}
      />
      <Switch>
        <Route path="/register">
          <RegisterReader
            setReaderRegistered={setReaderRegistered}
            registerReader={registerAndConnectReaderWorkFlow}
            errorOccured={errorOccured}
          />
        </Route>
        <Route path="/events">
          <EventSelector
            setEvent={setEvent}
          />
        </Route>
        <Route path="/checkout">
          <Checkout
            cart={Products}
            setCart={setCart}
            chargeAmount={chargeAmount}
            updateChargeAmount={setChargeAmount}
            setReaderDisplay={setReaderDisplayWorkFlow}
            errorOccured={errorOccured}
          />
        </Route>
        <Route path="/confirm">
          <AskCustomer
            terminal={terminal}
          />
        </Route>
        <Route path="/collect">
          <CollectPayment
            collectPayment={collectPaymentWorkFlow}
            cancelPayment={cancelPaymentWorkFlow}
            emptyCart={emptyCart}
            errorOccured={errorOccured}
            collectingPayment={workFlowInProgress}
            terminal={terminal}
          />
        </Route>
        <Route path="/success">
          <Success />
        </Route>
        <Route path="/">
          <Home />
        </Route>
        <Button onClick={() => terminal.clearReaderDisplay()}>Clear Reader</Button>
      </Switch>
    </div >
  );
}

const AppWrapper = () => {

  const client = new Client(BackendUrl)
  const terminal = client.initTerminal()

  return (
    <Router>
      <App
        client={client}
        terminal={terminal}
      />
    </Router>
  )
}

export default AppWrapper